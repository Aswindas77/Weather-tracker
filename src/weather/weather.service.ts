import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Weather } from './weather.schema';
import { Model } from 'mongoose';
import { CreateWeatherDto } from './weather.dto';
import axios from 'axios';

@Injectable()
export class WeatherService {
  constructor(
    @InjectModel(Weather.name) private weatherModel: Model<Weather>,
  ) {}



  
  async createWeather(data: CreateWeatherDto) {
    const { city, lat, lon } = data;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      throw new HttpException('API key is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;


    let weatherData;

    try {
      const response = await axios.get(url);
      weatherData = response.data;
    } catch (error: any) {
      const detail = error?.response?.data ?? error?.message ?? 'Unknown error';
      throw new HttpException(
        `Failed to fetch weather: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    
    const weatherReport = {
      temperature: weatherData?.main?.temp ?? 0,
      humidity: weatherData?.main?.humidity ?? 0,
      pressure: weatherData?.main?.pressure ?? 0,
    };

    const newEntry = await this.weatherModel.create({ city, lat, lon, weatherReport });
    return newEntry; 
  }





  
  async getAll() {
    return this.weatherModel.find().sort({ createdAt: -1 });
  }



  

  async getById(id: string) {
    const record = await this.weatherModel.findById(id);
    if (!record) throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    return record;
  }





  
  async update(id: string, data: CreateWeatherDto) {
    const updated = await this.weatherModel.findByIdAndUpdate(id, data, { new: true });

    if (!updated) throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    return updated;
  }




  
  async delete(id: string) {
    const deleted = await this.weatherModel.findByIdAndDelete(id);
    if (!deleted) throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    return { message: 'Record deleted successfully' };
  }
}
