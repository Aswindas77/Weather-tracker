import { Test, TestingModule } from '@nestjs/testing';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { CreateWeatherDto } from './weather.dto';

describe('WeatherController', () => {
  let controller: WeatherController;
  let service: WeatherService;

  const mockDto: CreateWeatherDto = { city: 'Delhi', lat: 28.6, lon: 77.2 };
  const mockWeather = { _id: '1', city: 'Delhi' };

  const mockService = {
  createWeather: jest.fn().mockResolvedValue(mockWeather),
  getAll: jest.fn().mockResolvedValue([mockWeather]),
  getWeatherUsingKafka: jest.fn().mockResolvedValue(mockWeather),   
  updateWeatherData: jest.fn().mockResolvedValue({ ...mockWeather, city: 'Updated' }), 
  delete: jest.fn().mockResolvedValue({ message: 'Record deleted successfully' }),
};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeatherController],
      providers: [{ provide: WeatherService, useValue: mockService }],
    }).compile();

    controller = module.get<WeatherController>(WeatherController);
    service = module.get<WeatherService>(WeatherService);
  });

  it('should be defined', () => expect(controller).toBeDefined());
  it('should create weather', async () => expect(await controller.create(mockDto)).toEqual(mockWeather));
  it('should get all weathers', async () => expect(await controller.getAll()).toEqual([mockWeather]));
  it('should get one weather', async () =>
  expect(await controller.getOne('1')).toEqual(mockWeather));

it('should update weather', async () =>
  expect(await controller.update('1', mockDto)).toEqual({ ...mockWeather, city: 'Updated' }));

  it('should delete weather', async () => expect(await controller.delete('1')).toEqual({ message: 'Record deleted successfully' }));
});
