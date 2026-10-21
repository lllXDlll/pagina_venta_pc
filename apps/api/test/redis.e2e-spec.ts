import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { EntornoModule } from '../src/config/entorno.module.js';
import { REDIS, RedisModule } from '../src/redis/redis.module.js';

describe('RedisModule (integración)', () => {
  it('hace PING al Redis de Docker', async () => {
    const modulo = await Test.createTestingModule({
      imports: [EntornoModule, RedisModule],
    }).compile();
    const redis = modulo.get<Redis>(REDIS);

    expect(redis.status).toBe('wait'); // lazyConnect: sin conexión hasta el primer comando
    await expect(redis.ping()).resolves.toBe('PONG');

    await modulo.close();
  });
});
