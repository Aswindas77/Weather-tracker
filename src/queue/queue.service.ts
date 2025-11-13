import {Injectable, Logger, OnModuleInit, OnModuleDestroy,}
 from '@nestjs/common';
import * as amqp from 'amqplib';
import  {CreateWeatherDto}  from '../weather/weather.dto';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connectionModel: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  


  async onModuleInit() {
    try {
      this.connectionModel = await amqp.connect('amqp://localhost:5672');
      this.channel = await this.connectionModel.createChannel();
      this.logger.log('RabbitMQ connected');
      console.log('raabit mq connected')
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }




  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connectionModel) {
        await this.connectionModel.close();
      }
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection', error);
    }
  }

  getChannel(): amqp.Channel | null {
    return this.channel;
  }



  async sendToQueue(queue: string, message: CreateWeatherDto): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    this.logger.log(`Message sent to ${queue}`);
  }

  
}




























