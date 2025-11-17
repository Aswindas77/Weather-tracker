import { forwardRef, Global, Module } from "@nestjs/common";
import { KafkaService } from "./kafka.service";
import { WeatherModule } from '../../weather/weather.module'
import { KafkaConsumer } from "./kafka.consumer";

@Global()
@Module({
    imports: [forwardRef(() => WeatherModule)],
    providers: [KafkaService, KafkaConsumer],
    exports: [KafkaService],
})

export class KafkaModule { }