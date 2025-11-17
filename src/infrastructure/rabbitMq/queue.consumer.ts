import { HttpException, HttpStatus, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RabbitMQService } from './queue.service';
import * as amqp from 'amqplib';
import { CreateWeatherDto } from '../../weather/weather.dto';
import axios, { AxiosError } from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Weather } from 'src/weather/weather.schema';
import { Model } from 'mongoose';




interface WeatherApiResponse {
  main: {
    temp: number;
    humidity: number;
    pressure: number;
  };
}

interface WeatherReport {
  temperature: number;
  humidity: number;
  pressure: number;
}


@Injectable()
export class RabbitConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(RabbitConsumer.name);

  

  constructor(
    @InjectModel(Weather.name) private weatherModel: Model<Weather>,
    private readonly rabbitMQService: RabbitMQService,
  ) { }
  async onApplicationBootstrap() {



    await this.consume('weather-requests', async (msg) => {
      this.logger.log(`[rabbit mq] Message received for city: ${msg.city}`);

      console.log("blaalala", msg)
      await this.processWeatherData(msg);
    });

  }

  async consume(
    queue: string,
    callback: (msg: CreateWeatherDto) => void | Promise<void>,
  ) {
    const channel = this.rabbitMQService.getChannel();
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    await this.setupQueue(channel, queue);
    this.registerConsumer(channel, queue, callback);
    this.logger.log(` Listening on queue "${queue}"`);
  }

  async processWeatherData(data: CreateWeatherDto) {
    const apiKey = this.validateApiKey();
    const weatherData = await this.fetchWeatherFromAPI(data, apiKey);
    const weatherReport = this.extractWeatherReport(weatherData);
    return await this.saveWeatherEntry(data, weatherReport);
  }

  private validateApiKey(): string {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new HttpException('API key is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return apiKey
  }


  private async fetchWeatherFromAPI(data: CreateWeatherDto, apiKey: string): Promise<WeatherApiResponse> {
    const url = this.buildWeatherUrl(data, apiKey);
    const response = await this.safeAxiosGet(url);
    return response.data;
  }


private async safeAxiosGet(url: string) {
    const response = await axios
      .get(url)
      .catch((error) => {
        throw this.buildWeatherFetchError(error as AxiosError);
      });
    return response;
  }



  private buildWeatherUrl(data: CreateWeatherDto, apiKey: string): string {
    const { lat, lon } = data;
    const baseUrl=process.env.WEATHER_BASE_URL;

    return `${baseUrl}?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  }

 
  private buildWeatherFetchError(error: AxiosError): HttpException {
    const detail = this.extractErrorDetail(error);
    const message =
      typeof detail === 'string'
        ? detail
        : JSON.stringify(detail);
    return new HttpException(`Failed to fetch weather: ${message}`, HttpStatus.BAD_REQUEST);
  }


  private extractErrorDetail(error: AxiosError):string | object {
    return (
      error?.response?.data ||
      'Unknown error'
    );
  }


  

  private extractWeatherReport(weatherData: WeatherApiResponse) {
    return {
      temperature: weatherData?.main?.temp ?? 0,
      humidity: weatherData?.main?.humidity ?? 0,
      pressure: weatherData?.main?.pressure ?? 0,
    };
  }


private async saveWeatherEntry(data: CreateWeatherDto, weatherReport: WeatherReport) {
    const { city, lat, lon } = data;
    return await this.weatherModel.create({ city, lat, lon, weatherReport });
  }


  private async setupQueue(
    channel: amqp.Channel,
    queue: string,
  ): Promise<void> {
    await channel.assertQueue(queue, { durable: true });
    void channel.prefetch(1);
  }



  private registerConsumer(
    channel: amqp.Channel,
    queue: string,
    callback: (msg: CreateWeatherDto) => void | Promise<void>,
  ): void {
    const onMessage = (msg: amqp.ConsumeMessage | null) =>
      this.onMessageReceived(channel, msg, callback);

    void channel.consume(queue, onMessage, { noAck: false });
  }
  
  private onMessageReceived(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage | null,
    callback: (msg: CreateWeatherDto) => void | Promise<void>,
  ): void {
    if (!msg) return;
    this.handleMessage(channel, msg, callback);
  }

  private handleMessage(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage,
    callback: (msg: CreateWeatherDto) => void | Promise<void>,
  ) {

    try {
      const data = JSON.parse(msg.content.toString()) as CreateWeatherDto;
      const result = callback(data);
      this.processResult(channel, msg, result);
    } catch (error) {
      this.handleError(channel, msg, error);
    }
  }

  private processResult(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage,
    result: void | Promise<void>,
  ) {
    Promise.resolve(result)
      .then(() => channel.ack(msg))
      .catch((err) => this.handleError(channel, msg, err));
  }

  private handleError(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage,
    error: AxiosError,
  ) {
    this.logger.error('Error processing message', error);
    channel.nack(msg, false, true);
  }
}
