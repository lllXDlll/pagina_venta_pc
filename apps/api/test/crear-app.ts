import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

/** URLs que apuntan a puertos cerrados: la conexión se rechaza de inmediato. */
export const POSTGRES_INACCESIBLE =
  'postgresql://xdtech:secreto-de-prueba@127.0.0.1:1/xdtech';
export const REDIS_INACCESIBLE = 'redis://:secreto-de-prueba@127.0.0.1:1';

/**
 * Crea la API completa con variables de entorno sobrescritas solo durante la construcción
 * (EntornoModule las lee al compilar el módulo).
 */
export async function crearApp(
  variables: Record<string, string> = {},
  ajustar: (builder: TestingModuleBuilder) => TestingModuleBuilder = (
    builder,
  ) => builder,
): Promise<INestApplication> {
  const original = { ...process.env };
  Object.assign(process.env, variables);
  try {
    const modulo = await ajustar(
      Test.createTestingModule({ imports: [AppModule] }),
    ).compile();
    const app = modulo.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configurarApp(app);
    await app.init();
    return app;
  } finally {
    process.env = original;
  }
}
