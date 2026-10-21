import type { NestExpressApplication } from '@nestjs/platform-express';
import { ENTORNO, type Entorno } from './config/entorno.js';

/** Configuración HTTP común a main.ts y a las pruebas e2e. */
export function configurarApp(app: NestExpressApplication): Entorno {
  const entorno = app.get<Entorno>(ENTORNO);

  // El navegador llama directo a api.xdtech.store (nube gris): el único proxy es el de Render.
  // Con el número de saltos correcto, req.ip es la IP real del cliente (X-Forwarded-For).
  app.set('trust proxy', entorno.trustProxyHops);

  // Credenciales solo desde el origen del frontend; nunca un comodín.
  app.enableCors({ origin: entorno.frontendOrigin, credentials: true });

  app.enableShutdownHooks();
  return entorno;
}
