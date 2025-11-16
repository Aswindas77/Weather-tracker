import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { KafkaService } from "./kafka.service";
import { WeatherService } from '../../weather/weather.service'



@Injectable()
export class KafkaConsumer implements OnModuleInit{
    private readonly logger =new Logger(KafkaConsumer.name)

    constructor(
        private readonly kafkaService:KafkaService,
        private readonly weatherService:WeatherService,
    ){}

    async onModuleInit() {
        const consumer = this.kafkaService.getConsumer();


        this.logger.log("Waiting for Kafka to become ready...");
    

        await consumer.subscribe({
            topic: "weather-update",
            fromBeginning: false,
        });

        this.logger.log("Kafka consumer subscribed to topic weather-update");

        consumer
            .run({
                eachMessage: async ({ message }) => {
                    try {
                        if (!message.value) {
                            this.logger.warn(`Received null message`);
                            return;
                        }

                        const jsonString = message.value.toString();
                        const data = JSON.parse(jsonString);

                        this.logger.log(`[~kafka~]Received message for city: ${data.city}`);

                        const { id, ...weatherData } = data;
                        await this.weatherService.updateWeatherData(id, weatherData);
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