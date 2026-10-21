import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PostgresIndicador } from './postgres.indicador.js';
import { RedisIndicador } from './redis.indicador.js';

/**
 * Vida del proceso. Sin dependencias inyectadas: no toca Postgres ni Redis, así que el
 * monitor externo (UptimeRobot) puede llamarlo cada 5 min sin despertar a Neon ni
 * gastar comandos de Upstash. Es el único endpoint que debe usar el monitor.
 */
@Controller('health')
export class VidaController {
  @Get('live')
  vida() {
    return { status: 'ok' };
  }
}

/**
 * Disponibilidad de las dependencias: 200 si Postgres y Redis responden, 503 si no.
 * Solo para CI y uso manual; nunca desde el monitor (consumiría CU-hours de Neon y cuota de Upstash).
 */
@Controller('health')
export class DisponibilidadController {
  constructor(
    private readonly salud: HealthCheckService,
    private readonly postgres: PostgresIndicador,
    private readonly redis: RedisIndicador,
  ) {}

  @Get('ready')
  @HealthCheck()
  disponibilidad() {
    return this.salud.check([
      () => this.postgres.verificar(),
      () => this.redis.verificar(),
    ]);
  }
}
