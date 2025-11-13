import { forwardRef, Module } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Weather, WeatherSchema } from './weather.schema';
import { QueueModule } from '../infrastructure/rabbitMq/queue.module';


@Module({
  imports: [
    MongooseModule.forFeature([{ name: Weather.name, schema: WeatherSchema }]),
    forwardRef(() => QueueModule),
  ],
  controllers: [WeatherController],
  providers: [WeatherService],
  exports:[WeatherService]
})
export class WeatherModule {}
