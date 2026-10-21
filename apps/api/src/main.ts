import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { cargarEnvLocal } from './config/cargar-env.js';
import { configurarApp } from './configurar-app.js';

async function bootstrap() {
  cargarEnvLocal();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.crear(),
  );
  const entorno = configurarApp(app);
  await app.listen(entorno.port);
}
await bootstrap();
