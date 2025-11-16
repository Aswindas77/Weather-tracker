import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RabbitMQService } from './queue.service';
import * as amqp from 'amqplib';
import { CreateWeatherDto } from '../../weather/weather.dto';
import { WeatherService } from '../../weather/weather.service';

@Injectable()
export class RabbitConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(RabbitConsumer.name);


  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly weatherService: WeatherService,
  ) {}



  async onApplicationBootstrap() {
    await this.consume('weather-requests', async (msg) => {
      this.logger.log(`[rabbit mq] Message received for city: ${msg.city}`);
      await this.weatherService.processWeatherData(msg);
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
    result: any,
  ) {
    Promise.resolve(result)
      .then(() => channel.ack(msg))
      .catch((err) => this.handleError(channel, msg, err));
  }

  private handleError(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage,
    error: any,
  ) {
    this.logger.error('Error processing message', error);
    channel.nack(msg, false, true);
  }
}
