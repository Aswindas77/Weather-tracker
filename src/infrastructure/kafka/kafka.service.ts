import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Consumer, Kafka, logLevel, Partitioners, Producer } from "kafkajs";




@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaService.name);
    private kafka: Kafka;
    private producer: Producer;
    private consumer: Consumer;
    constructor() {
        this.kafka = new Kafka({
            clientId: 'weather-traker',
            brokers: ['localhost:9092'],
            logLevel: logLevel.NOTHING,
            logCreator: () => () => { },
        });
        this.producer = this.kafka.producer({
            createPartitioner: Partitioners.LegacyPartitioner,
        });
        this.consumer = this.kafka.consumer({ groupId: 'weather-group' });
    }
    async onModuleInit() {
        await Promise.all([
            this.producer.connect(),
            this.consumer.connect(),
        ]);
        this.logger.log('Kafka client connected');
    }
    async onModuleDestroy() {
        await Promise.allSettled([
            this.producer.disconnect(),
            this.consumer.disconnect(),
        ]);
        this.logger.log('Kafka client disconnected');
    }
    async sendMessage(topic: string, message: object) {
        await this.producer.send({
            topic,
            messages: [{ value: JSON.stringify(message) }],
        });
        this.logger.log(`Sent message to topic: ${topic}`);
    }
    getProducer(): Producer {
        return this.producer;
    }
    getConsumer(): Consumer {
        return this.consumer;
    }
}