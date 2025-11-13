import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeatherModule } from './weather/weather.module';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './infrastructure/rabbitMq/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URI || ''),
    QueueModule,
    WeatherModule,
  ],
})
export class AppModule {}
