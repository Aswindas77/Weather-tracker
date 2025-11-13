import { Test, TestingModule } from '@nestjs/testing';
import { WeatherService } from './weather.service';
import { RabbitMQService } from '../queue/queue.service';
import { getModelToken } from '@nestjs/mongoose';
import { Weather } from './weather.schema';
import axios from 'axios';
import { HttpException } from '@nestjs/common';
import { Model } from 'mongoose';

jest.mock('axios'); 

describe('WeatherService', () => {
  let service: WeatherService;
  let rabbitService: RabbitMQService;
  let weatherModel: Model<Weather>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        {
          provide: RabbitMQService,
          useValue: {
            sendToQueue: jest.fn(),
          },
        },
        {
          provide: getModelToken(Weather.name),
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findByIdAndDelete: jest.fn(),
            create: jest.fn(),
            sort: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WeatherService>(WeatherService);
    rabbitService = module.get<RabbitMQService>(RabbitMQService);
    weatherModel = module.get<Model<Weather>>(getModelToken(Weather.name));
  });

  
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  
  describe('createWeather', () => {
    it('should send a message to RabbitMQ queue', async () => {
      const dto = { city: 'Delhi', lat: 28.6, lon: 77.2 };
      await service.createWeather(dto);

      expect(rabbitService.sendToQueue).toHaveBeenCalledWith(
        'weather-requests',
        dto,
      );
    });
  });

  
  describe('processWeatherData', () => {
    const dto = { city: 'Delhi', lat: 28.6, lon: 77.2 };

    beforeEach(() => {
      process.env.OPENWEATHER_API_KEY = 'mock-key';
    });

    it('should throw error if API key is missing', async () => {
      delete process.env.OPENWEATHER_API_KEY;

      await expect(service.processWeatherData(dto)).rejects.toThrow(
        new HttpException('API key is missing', 500),
      );
    });

    it('should fetch data from API and save in DB', async () => {
      const mockApiResponse = {
        data: { main: { temp: 28, humidity: 65, pressure: 1009 } },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockApiResponse);
      (weatherModel.create as jest.Mock).mockResolvedValue({
        _id: '1',
        city: 'Delhi',
      });

      const result = await service.processWeatherData(dto);

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(weatherModel.create).toHaveBeenCalled();
      expect(result).toEqual({ _id: '1', city: 'Delhi' });
    });

    it('should handle API failure gracefully', async () => {
      (axios.get as jest.Mock).mockRejectedValue({
        response: { data: 'API limit exceeded' },
      });

      await expect(service.processWeatherData(dto)).rejects.toThrow(
        /Failed to fetch weather/,
      );
    });
  });

  
  describe('getAll', () => {
    it('should return all weather entries', async () => {
      const mockData = [{ city: 'Delhi' }, { city: 'Mumbai' }];

      const mockFind = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockData),
      });
      (weatherModel.find as any) = mockFind;

      const result = await service.getAll();

      expect(mockFind).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
  });

  
  describe('getById', () => {
    it('should return record if found', async () => {
      const mockRecord = { _id: '1', city: 'Delhi' };
      (weatherModel.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await service.getById('1');
      expect(result).toEqual(mockRecord);
    });

    it('should throw if record not found', async () => {
      (weatherModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getById('1')).rejects.toThrow('Record not found');
    });
  });

  
  describe('update', () => {
    it('should update record successfully', async () => {
      const mockRecord = { _id: '1', city: 'Delhi Updated' };
      (weatherModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const result = await service.update('1', mockRecord as any);
      expect(result).toEqual(mockRecord);
    });

    it('should throw if record not found', async () => {
      (weatherModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('1', { city: 'Test' } as any),
      ).rejects.toThrow('Record not found');
    });
  });

  
  describe('delete', () => {
    it('should delete record successfully', async () => {
      (weatherModel.findByIdAndDelete as jest.Mock).mockResolvedValue({
        _id: '1',
      });

      const result = await service.delete('1');
      expect(result).toEqual({ message: 'Record deleted successfully' });
    });

    it('should throw if record not found', async () => {
      (weatherModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('1')).rejects.toThrow('Record not found');
    });
  });
});
