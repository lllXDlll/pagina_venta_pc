import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import { conTiempoLimite } from './con-tiempo-limite.js';

const TIEMPO_LIMITE_MS = 3_000;

@Injectable()
export class RedisIndicador {
  constructor(
    private readonly salud: HealthIndicatorService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async verificar() {
    const indicador = this.salud.check('redis');
    try {
      await conTiempoLimite(this.redis.ping(), TIEMPO_LIMITE_MS);
      return indicador.up();
    } catch {
      // Mensaje fijo: el error original puede incluir la URL de Redis
      return indicador.down({ message: 'Redis no responde' });
    }
  }
}
