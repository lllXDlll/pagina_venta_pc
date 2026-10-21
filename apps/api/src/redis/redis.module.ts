import {
  Global,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENTORNO, type Entorno } from '../config/entorno.js';

export const REDIS = Symbol('REDIS');

/**
 * Cliente ioredis compartido (salud ahora; reservas en el Sprint 3).
 * `rediss://` activa TLS (Upstash). La conexión es perezosa: no se abre hasta el
 * primer comando, de modo que arrancar la API o llamar a /health/live no gasta cuota.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno) => {
        const logger = new Logger('Redis');
        const redis = new Redis(entorno.redisUrl, { lazyConnect: true });
        // Sin este listener, ioredis registra cada fallo de reconexión como "Unhandled error event".
        // Solo se registra el código para no exponer la URL ni credenciales.
        redis.on('error', (error: NodeJS.ErrnoException) => {
          logger.warn(
            `Error de conexión con Redis (${error.code ?? error.name})`,
          );
        });
        return redis;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
