import { Test, TestingModule } from '@nestjs/testing';
import { WeatherService } from './weather.service';
import { RabbitMQService } from '../infrastructure/rabbitMq/queue.service';
import { KafkaService } from '../infrastructure/kafka/kafka.service';
import { getModelToken } from '@nestjs/mongoose';
import { Weather } from './weather.schema';
import axios from 'axios';
import { Model } from 'mongoose';

jest.mock('axios');

const mockWeatherRecord = {
  _id: '1',
  city: 'Delhi',
  lat: 28.6,
  lon: 77.2,
  toObject: () => ({ _id: '1', city: 'Delhi' }),
};

const mockAPIResponse = {
  data: { main: { temp: 25, humidity: 40, pressure: 1010 } },
};

const mockWeatherModel = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
};

const mockRabbitService = {
  sendToQueue: jest.fn(),
};

const mockKafkaService = {
  sendMessage: jest.fn(),
};

describe('WeatherService', () => {
  let service: WeatherService;
  let rabbitService: RabbitMQService;
  let kafkaService: KafkaService;
  let weatherModel: Model<Weather>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        { provide: RabbitMQService, useValue: mockRabbitService },
        { provide: KafkaService, useValue: mockKafkaService },
        { provide: getModelToken(Weather.name), useValue: mockWeatherModel },
      ],
    }).compile();

    service = module.get<WeatherService>(WeatherService);
    rabbitService = module.get<RabbitMQService>(RabbitMQService);
    kafkaService = module.get<KafkaService>(KafkaService);
    weatherModel = module.get<Model<Weather>>(getModelToken(Weather.name));

    process.env.OPENWEATHER_API_KEY = 'mock-key';
    jest.clearAllMocks();
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


  describe('getWeatherUsingKafka', () => {
    it('should send weather update to Kafka with weatherReport', async () => {
      mockWeatherModel.findById.mockResolvedValue(mockWeatherRecord);
      (axios.get as jest.Mock).mockResolvedValue(mockAPIResponse);

      const result = await service.getWeatherUsingKafka('1');

      expect(mockKafkaService.sendMessage).toHaveBeenCalledTimes(1);

      const sentMessage = mockKafkaService.sendMessage.mock.calls[0];

      expect(sentMessage[0]).toBe('weather_topic');
      expect(sentMessage[1]).toHaveProperty('payload');

      expect(sentMessage[1].payload).toMatchObject({
        id: '1',
        city: 'Delhi',
        lat: 28.6,
        lon: 77.2,
        weatherReport: {
          temperature: 25,
          humidity: 40,
          pressure: 1010,
        },
      });

      expect(result.weatherReport).toMatchObject({
        temperature: 25,
        humidity: 40,
        pressure: 1010,
      });
    });

    it('should throw if record not found', async () => {
      mockWeatherModel.findById.mockResolvedValue(null);

      await expect(service.getWeatherUsingKafka('10')).rejects.toThrow(
        'City not found',
      );
    });
  });


  describe('getAll', () => {
    it('should return all records', async () => {
      const mockData = [{ city: 'Delhi' }, { city: 'Mumbai' }];

      mockWeatherModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockData),
      });

      const result = await service.getAll();
      expect(result).toEqual(mockData);
    });
  });


  describe('getById', () => {
    it('should return record', async () => {
      const mockRecord = { _id: '1', city: 'Delhi' };

      mockWeatherModel.findById.mockResolvedValue(mockRecord);

      const result = await service.getById('1');
      expect(result).toEqual(mockRecord);
    });

    it('should throw if not found', async () => {
      mockWeatherModel.findById.mockResolvedValue(null);

      await expect(service.getById('1')).rejects.toThrow('Record not found');
    });
  });


  describe('updateWeatherData', () => {
    it('should update successfully', async () => {
      const dto = { city: 'Delhi', lat: 28.6, lon: 77.2 };

      const mockAPI = {
        data: { main: { temp: 26, humidity: 60, pressure: 1011 } },
      };

      const updated = { _id: '1', weatherReport: { temp: 26 } };

      (axios.get as jest.Mock).mockResolvedValue(mockAPI);
      mockWeatherModel.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateWeatherData('1', dto);
      expect(result).toEqual(updated);
    });

    it('should throw if record not found', async () => {
      mockWeatherModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        service.updateWeatherData('1', { city: 'Test', lat: 0, lon: 0 }),
      ).rejects.toThrow('Weather record with id 1 not found');
    });
  });


  describe('delete', () => {
    it('should delete record', async () => {
      mockWeatherModel.findByIdAndDelete.mockResolvedValue({ _id: '1' });

      const result = await service.delete('1');
      expect(result).toEqual({ message: 'Record deleted successfully' });
    });

    it('should throw if not found', async () => {
      mockWeatherModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.delete('1')).rejects.toThrow('Record not found');
    });
  });
});
