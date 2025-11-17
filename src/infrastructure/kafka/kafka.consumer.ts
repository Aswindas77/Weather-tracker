import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { KafkaService } from "./kafka.service";
import { WeatherService } from '../../weather/weather.service'

@Injectable()
export class KafkaConsumer implements OnModuleInit {
  private readonly logger = new Logger(KafkaConsumer.name)
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly weatherService: WeatherService,
  ) { }
  async onModuleInit() {
    const consumer = this.kafkaService.getConsumer();
    this.logger.log("Waiting for Kafka to become ready...")
    await consumer.subscribe({
      topic: "weather_topic",
      fromBeginning: false,
    });
    this.logger.log("Kafka consumer subscribed to topic weather-update");
    consumer
      .run({
        eachMessage: async ({ message }) => {
          try {
            if (!message.value) return;
            const raw = JSON.parse(message.value.toString());
            const payload = raw.payload;
            if (!payload) {
              this.logger.error("Invalid payload format");
              return;
            }
            const { id, city, lat, lon } = payload;
            this.logger.log(`[~kafka~] Received message for city: ${city}`);
            await this.weatherService.updateWeatherData(id, { city, lat, lon });
          } catch (error) {
            this.logger.error('Failed to process weather message', error);
          }
        },
      })
      .catch((error) => {
        this.logger.error('Kafka consumer failed', error);
      });
  }
}