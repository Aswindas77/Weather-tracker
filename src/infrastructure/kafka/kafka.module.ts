import { forwardRef, Global, Module } from "@nestjs/common";
import { KafkaService } from "./kafka.service";
import { WeatherModule } from '../../weather/weather.module'

import { KafkaConsumer } from "./kafka.consumer";
import { KafkaProducer } from "./kafka.producer";


@Global()
@Module({
    imports:[forwardRef(()=>WeatherModule)],
    providers:[KafkaService,KafkaProducer,KafkaConsumer],
    exports:[KafkaService,],
})

export class KafkaModule {}