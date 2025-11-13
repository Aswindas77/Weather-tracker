import { Module, Global, forwardRef } from '@nestjs/common';
import { RabbitMQService } from './queue.service';
import { RabbitConsumer } from './queue.consumer';

import { WeatherModule } from '../../weather/weather.module'

@Global()
@Module({
  imports:[forwardRef(()=>WeatherModule)],
  providers: [RabbitMQService,RabbitConsumer],
  exports: [RabbitMQService,RabbitConsumer],
})
export class QueueModule {}

