import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import {
  DisponibilidadController,
  VidaController,
} from './health.controller.js';
import { PostgresIndicador } from './postgres.indicador.js';
import { RedisIndicador } from './redis.indicador.js';

@Module({
  imports: [TerminusModule.forRoot({ logger: false })],
  controllers: [VidaController, DisponibilidadController],
  providers: [PostgresIndicador, RedisIndicador],
})
export class HealthModule {}
