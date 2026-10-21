import { type DynamicModule, Module } from '@nestjs/common';
import { EntornoModule } from './config/entorno.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DiagnosticoModule } from './diagnostico/diagnostico.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [EntornoModule, DatabaseModule, RedisModule, HealthModule],
})
export class AppModule {
  /** Agrega los endpoints temporales de diagnóstico (HU-36b) si DIAGNOSTICO_HABILITADO=true. */
  static crear(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    return {
      module: AppModule,
      imports: env.DIAGNOSTICO_HABILITADO === 'true' ? [DiagnosticoModule] : [],
    };
  }
}
