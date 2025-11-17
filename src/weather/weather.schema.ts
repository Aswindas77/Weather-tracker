import { Prop,Schema,SchemaFactory } from "@nestjs/mongoose";

import { Document } from "mongoose";

@Schema({timestamps:true})
export class Weather extends Document {
    @Prop({required:true})
    city:string;
    @Prop({required:true})
    lat:number;
    @Prop({required:true})
    lon:number;
    @Prop({
        type: {
            temperature: { type: Number, required: true },
            humidity: { type: Number, required: true },
            pressure: { type: Number, required: true },
        },
        required: true,
    })
    weatherReport: { temperature: number; humidity: number; pressure: number };
}

export const WeatherSchema = SchemaFactory.createForClass(Weather);