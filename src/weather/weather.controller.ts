import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { CreateWeatherDto } from './weather.dto';

@Controller('weathers')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) { }
  @Post()
  create(@Body() data: CreateWeatherDto) {
    return this.weatherService.createWeather(data)
  }
  @Get()
  getAll() {
    return this.weatherService.getAll();
  }
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.weatherService.getWeatherUsingKafka(id);
  }
  @Put(':id')
  update(@Param('id') id: string, @Body() data: CreateWeatherDto) {
    return this.weatherService.updateWeatherData(id, data);
  }
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.weatherService.delete(id);
  }
}
