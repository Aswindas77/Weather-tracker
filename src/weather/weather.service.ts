import { HttpException, HttpStatus, Injectable, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Weather } from './weather.schema';
import { Model } from 'mongoose';
import { CreateWeatherDto } from './weather.dto';
import { RabbitMQService } from '../infrastructure/rabbitMq/queue.service';
import axios from 'axios';
import { KafkaService } from 'src/infrastructure/kafka/kafka.service';


@Injectable()
export class WeatherService {
  
  private readonly WEATHER_QUEUE = 'weather-requests';

  constructor(
    @InjectModel(Weather.name) private weatherModel: Model<Weather>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly kafkaService:KafkaService,
  ) {}

  async createWeather(data: CreateWeatherDto) {
    await this.rabbitMQService.sendToQueue(this.WEATHER_QUEUE, data);
    
    return {
      message: 'Weather request queued successfully',
      city: data.city,
      
    };
  }


  async processWeatherData(data: CreateWeatherDto) {
    const apiKey = this.validateApiKey();
  const weatherData = await this.fetchWeatherFromAPI(data, apiKey);
  const weatherReport = this.extractWeatherReport(weatherData);
  return await this.saveWeatherEntry(data, weatherReport);
  }

  private validateApiKey():string {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
    throw new HttpException('API key is missing', HttpStatus.INTERNAL_SERVER_ERROR);
  }
  return apiKey
  }

private async fetchWeatherFromAPI(data: CreateWeatherDto, apiKey: string) {
  const url = this.buildWeatherUrl(data, apiKey);
  const response = await this.safeAxiosGet(url);
  return response.data;
}


private async safeAxiosGet(url: string) {
  const response = await axios
    .get(url)
    .catch((error: any) => {
      throw this.buildWeatherFetchError(error);
    });
  return response;
}



private buildWeatherUrl(data: CreateWeatherDto, apiKey: string): string {
  const { lat, lon } = data;
  return `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
}


private buildWeatherFetchError(error: any): HttpException {
  const detail = this.extractErrorDetail(error);
  const message =
    typeof detail === 'string'
      ? detail
      : JSON.stringify(detail);
  return new HttpException(`Failed to fetch weather: ${message}`, HttpStatus.BAD_REQUEST);
}

private extractErrorDetail(error: any): any {
  return (
    error?.response?.data ||
    'Unknown error'
  );
}

private extractWeatherReport(weatherData: any) {
  return {
    temperature: weatherData?.main?.temp ?? 0,
    humidity: weatherData?.main?.humidity ?? 0,
    pressure: weatherData?.main?.pressure ?? 0,
  };
}


private async saveWeatherEntry(data: CreateWeatherDto, weatherReport: any) {
  const { city, lat, lon } = data;
  return await this.weatherModel.create({ city, lat, lon, weatherReport });
}


  
  async getAll() {
    return this.weatherModel.find().sort({ createdAt: -1 });
  }



  

  async getById(id: string) {
    const record = await this.weatherModel.findById(id);
    if (!record) throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    return record;
  }





  
  async getWeatherUsingKafka(id: string) {

    const record =await this.weatherModel.findById(id)

   
     if (!record) throw new HttpException("City not found", HttpStatus.NOT_FOUND);

    const apiKey=this.validateApiKey();
    const liveWeather = await this.fetchWeatherFromAPI({
    city: record.city,
    lat: record.lat,
    lon: record.lon,
    }, apiKey);
    
    const weatherReport=this.extractWeatherReport(liveWeather);

    const payload = {
    id: record._id,    
    city: record.city,
    lat: record.lat,
    lon: record.lon,
  } as const;

    this.kafkaService.sendMessage('weather-update',{payload});

    return {
      ...record.toObject(),
      weatherReport,
    };
    
    
  }


  
  async updateWeatherData(id:string, data:CreateWeatherDto){
    const apiKey=this.validateApiKey();

    const weatherData = await this.fetchWeatherFromAPI(data, apiKey);

    const weatherReport = this.extractWeatherReport(weatherData);

    const updated=await this.weatherModel.findByIdAndUpdate(
      id,
      {
        weatherReport,
        updatedAt:new Date(),
      },
      {new:true}
    );

    if(!updated){
      throw new HttpException(`Weather record with id ${id} not found`,HttpStatus.NOT_FOUND,)
    }
    return updated
  }




  
  async delete(id: string) {
    const deleted = await this.weatherModel.findByIdAndDelete(id);
    if (!deleted) throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    return { message: 'Record deleted successfully' };
  }
}
