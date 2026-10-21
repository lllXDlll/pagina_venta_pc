import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENTORNO, type Entorno } from '../config/entorno.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** Espera de conexión por defecto: holgada frente a los segundos que tarda Neon en despertar. */
const CONNECT_TIMEOUT_POR_DEFECTO_S = 30;

/**
 * Lee `connect_timeout` (segundos) de la cadena de conexión. El driver `pg` no lo
 * aplica por sí mismo, así que se traduce a `connectionTimeoutMillis`.
 */
export function connectTimeoutMs(databaseUrl: string): number {
  const crudo = new URL(databaseUrl).searchParams.get('connect_timeout');
  const segundos = crudo === null ? NaN : Number(crudo);
  return (
    (Number.isFinite(segundos) && segundos > 0
      ? segundos
      : CONNECT_TIMEOUT_POR_DEFECTO_S) * 1000
  );
}

/**
 * Cliente de Prisma de la app: usa DATABASE_URL (pooler de Neon en producción).
 * Conecta de forma perezosa en la primera consulta, así que arrancar la API no despierta a Neon.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENTORNO) entorno: Entorno) {
    super({
      adapter: new PrismaPg({
        connectionString: entorno.databaseUrl,
        connectionTimeoutMillis: connectTimeoutMs(entorno.databaseUrl),
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
