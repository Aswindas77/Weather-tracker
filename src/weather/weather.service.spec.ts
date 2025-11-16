import { Test, TestingModule } from '@nestjs/testing';
import { WeatherService } from './weather.service';
import { RabbitMQService } from '../infrastructure/rabbitMq/queue.service';
import { KafkaService } from '../infrastructure/kafka/kafka.service';
import { getModelToken } from '@nestjs/mongoose';
import { Weather } from './weather.schema';
import axios from 'axios';
import { HttpException } from '@nestjs/common';
import { Model } from 'mongoose';

jest.mock('axios');

describe('WeatherService', () => {
  let service: WeatherService;
  let rabbitService: RabbitMQService;
  let kafkaService: KafkaService;
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
          provide: KafkaService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
        {
          provide: getModelToken(Weather.name),
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndDelete: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WeatherService>(WeatherService);
    rabbitService = module.get<RabbitMQService>(RabbitMQService);
    kafkaService = module.get<KafkaService>(KafkaService);
    weatherModel = module.get<Model<Weather>>(getModelToken(Weather.name));

    process.env.OPENWEATHER_API_KEY = 'mock-key';
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  
  describe('createWeather', () => {
    it('should send message to RabbitMQ queue', async () => {
      const dto = { city: 'Delhi', lat: 28.6, lon: 77.2 };

      await service.createWeather(dto);

      expect(rabbitService.sendToQueue).toHaveBeenCalledWith(
        'weather-requests',
        dto,
      );
    });
  });

  // ----------------------------------------------------------
  // processWeatherData()
  // ----------------------------------------------------------
  describe('processWeatherData', () => {
    const dto = { city: 'Delhi', lat: 28.6, lon: 77.2 };

    it('should throw error if API key missing', async () => {
      delete process.env.OPENWEATHER_API_KEY;

      await expect(service.processWeatherData(dto)).rejects.toThrow(
        new HttpException('API key is missing', 500),
      );
    });

    it('should fetch weather and save to DB', async () => {
      const mockAPI = {
        data: { main: { temp: 25, humidity: 40, pressure: 1010 } },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockAPI);
      (weatherModel.create as jest.Mock).mockResolvedValue({
        _id: '1',
        city: 'Delhi',
      });

      const result = await service.processWeatherData(dto);

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(weatherModel.create).toHaveBeenCalled();
      expect(result).toEqual({ _id: '1', city: 'Delhi' });
    });

    it('should throw error on API failure', async () => {
      (axios.get as jest.Mock).mockRejectedValue({
        response: { data: 'API limit exceeded' },
      });

      await expect(service.processWeatherData(dto)).rejects.toThrow(
        /Failed to fetch weather/,
      );
    });
  });

  // ----------------------------------------------------------
  // getAll()
  // ----------------------------------------------------------
  describe('getAll', () => {
    it('should return all records', async () => {
      const mockData = [{ city: 'Delhi' }, { city: 'Mumbai' }];

      (weatherModel.find as any) = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockData),
      });

      const result = await service.getAll();
      expect(result).toEqual(mockData);
    });
  });

  // ----------------------------------------------------------
  // getById()
  // ----------------------------------------------------------
  describe('getById', () => {
    it('should return record', async () => {
      const mockRecord = { _id: '1', city: 'Delhi' };

      (weatherModel.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await service.getById('1');
      expect(result).toEqual(mockRecord);
    });

    it('should throw if not found', async () => {
      (weatherModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getById('1')).rejects.toThrow('Record not found');
    });
  });

  // ----------------------------------------------------------
  // updateWeatherData()
  // ----------------------------------------------------------
  describe('updateWeatherData', () => {
    it('should update successfully', async () => {
      const dto = { city: 'Delhi', lat: 28.6, lon: 77.2 };

      const mockAPI = {
        data: { main: { temp: 26, humidity: 60, pressure: 1011 } },
      };

      const updated = {
        _id: '1',
        weatherReport: { temp: 26 },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockAPI);
      (weatherModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateWeatherData('1', dto);

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(weatherModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('should throw if record not found', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { main: { temp: 26, humidity: 60, pressure: 1011 } },
      });

      (weatherModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateWeatherData('1', {
          city: 'Test',
          lat: 0,
          lon: 0,
        }),
      ).rejects.toThrow('Weather record with id 1 not found');
    });
  });

  // ----------------------------------------------------------
  // delete()
  // ----------------------------------------------------------
  describe('delete', () => {
    it('should delete record', async () => {
      (weatherModel.findByIdAndDelete as jest.Mock).mockResolvedValue({
        _id: '1',
      });

      const result = await service.delete('1');
      expect(result).toEqual({ message: 'Record deleted successfully' });
    });

    it('should throw if not found', async () => {
      (weatherModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('1')).rejects.toThrow('Record not found');
    });
  });
});
