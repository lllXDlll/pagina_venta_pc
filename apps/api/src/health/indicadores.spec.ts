import { jest } from '@jest/globals';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import type { Entorno } from '../config/entorno.js';
import type { PrismaService } from '../database/prisma.service.js';
import { PostgresIndicador } from './postgres.indicador.js';
import { RedisIndicador } from './redis.indicador.js';

const entorno = {
  databaseUrl: 'postgresql://u:secreto@db.ejemplo:5432/x?connect_timeout=1',
} as Entorno;

describe('PostgresIndicador', () => {
  const crear = (queryRaw: () => Promise<unknown>) =>
    new PostgresIndicador(
      new HealthIndicatorService(),
      { $queryRaw: queryRaw } as unknown as PrismaService,
      entorno,
    );

  it('marca postgres como up si SELECT 1 responde', async () => {
    const indicador = crear(() => Promise.resolve([{ '?column?': 1 }]));
    await expect(indicador.verificar()).resolves.toEqual({
      postgres: { status: 'up' },
    });
  });

  it('marca postgres como down sin exponer el error original', async () => {
    const indicador = crear(() =>
      Promise.reject(
        new Error('connect ECONNREFUSED postgresql://u:secreto@db.ejemplo'),
      ),
    );
    await expect(indicador.verificar()).resolves.toEqual({
      postgres: { status: 'down', message: 'Postgres no responde' },
    });
  });
});

describe('RedisIndicador', () => {
  const crear = (ping: () => Promise<string>) =>
    new RedisIndicador(new HealthIndicatorService(), {
      ping,
    } as unknown as Redis);

  it('marca redis como up si PING responde', async () => {
    await expect(
      crear(() => Promise.resolve('PONG')).verificar(),
    ).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('marca redis como down si PING falla', async () => {
    const indicador = crear(() =>
      Promise.reject(new Error('redis://:secreto@host')),
    );
    await expect(indicador.verificar()).resolves.toEqual({
      redis: { status: 'down', message: 'Redis no responde' },
    });
  });

  it('marca redis como down si PING no responde a tiempo', async () => {
    jest.useFakeTimers();
    try {
      const resultado = crear(() => new Promise<string>(() => {})).verificar();
      await jest.advanceTimersByTimeAsync(3_000);
      await expect(resultado).resolves.toEqual({
        redis: { status: 'down', message: 'Redis no responde' },
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
