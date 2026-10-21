import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { ENTORNO, type Entorno } from '../config/entorno.js';
import { connectTimeoutMs, PrismaService } from '../database/prisma.service.js';
import { conTiempoLimite } from './con-tiempo-limite.js';

/** Margen sobre la espera de conexión para que la consulta termine tras despertar a Neon. */
const MARGEN_CONSULTA_MS = 5_000;

@Injectable()
export class PostgresIndicador {
  private readonly tiempoLimiteMs: number;

  constructor(
    private readonly salud: HealthIndicatorService,
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) entorno: Entorno,
  ) {
    this.tiempoLimiteMs =
      connectTimeoutMs(entorno.databaseUrl) + MARGEN_CONSULTA_MS;
  }

  async verificar() {
    const indicador = this.salud.check('postgres');
    try {
      await conTiempoLimite(
        this.prisma.$queryRaw`SELECT 1`,
        this.tiempoLimiteMs,
      );
      return indicador.up();
    } catch {
      // Mensaje fijo: el error original puede incluir host, usuario o cadena de conexión
      return indicador.down({ message: 'Postgres no responde' });
    }
  }
}
