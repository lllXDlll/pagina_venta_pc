import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { REDIS } from '../src/redis/redis.module.js';
import {
  crearApp,
  POSTGRES_INACCESIBLE,
  REDIS_INACCESIBLE,
} from './crear-app.js';

describe('Salud (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  describe('GET /health/live', () => {
    it('responde 200 con Postgres y Redis inaccesibles', async () => {
      app = await crearApp({
        DATABASE_URL: POSTGRES_INACCESIBLE,
        REDIS_URL: REDIS_INACCESIBLE,
      });
      await request(app.getHttpServer())
        .get('/health/live')
        .expect(200, { status: 'ok' });
    });

    it('no ejecuta consultas a Postgres ni comandos a Redis', async () => {
      const prisma = { $queryRaw: jest.fn(), $disconnect: jest.fn() };
      const redis = { ping: jest.fn(), disconnect: jest.fn() };
      app = await crearApp({}, (builder) =>
        builder
          .overrideProvider(PrismaService)
          .useValue(prisma)
          .overrideProvider(REDIS)
          .useValue(redis),
      );

      await request(app.getHttpServer()).get('/health/live').expect(200);

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(redis.ping).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('responde 200 con Postgres y Redis disponibles', async () => {
      app = await crearApp();
      const { body } = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
      expect(body.details).toEqual({
        postgres: { status: 'up' },
        redis: { status: 'up' },
      });
    });

    it('responde 503 nombrando a Redis cuando no está disponible', async () => {
      app = await crearApp({ REDIS_URL: REDIS_INACCESIBLE });
      const respuesta = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);
      expect(respuesta.body.error).toEqual({
        redis: { status: 'down', message: 'Redis no responde' },
      });
      expect(respuesta.body.details.postgres).toEqual({ status: 'up' });
      expect(respuesta.text).not.toMatch(
        /secreto-de-prueba|127\.0\.0\.1|redis:\/\//,
      );
    });

    it('responde 503 nombrando a Postgres cuando no está disponible', async () => {
      app = await crearApp({ DATABASE_URL: POSTGRES_INACCESIBLE });
      const respuesta = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);
      expect(respuesta.body.error).toEqual({
        postgres: { status: 'down', message: 'Postgres no responde' },
      });
      expect(respuesta.body.details.redis).toEqual({ status: 'up' });
      expect(respuesta.text).not.toMatch(
        /secreto-de-prueba|127\.0\.0\.1|postgresql:\/\//,
      );
    });
  });
});
