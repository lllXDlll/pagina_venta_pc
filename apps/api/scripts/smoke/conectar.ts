import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Redis } from 'ioredis';

/**
 * Conecta al Redis de REDIS_URL. Sin variable definida, usa el .env de la raíz (Docker).
 * Para Upstash: REDIS_URL='rediss://...' pnpm --filter api smoke:<script>
 */
export function conectar(): Redis {
  const envLocal = resolve(import.meta.dirname, '../../../../.env');
  if (!process.env.REDIS_URL && existsSync(envLocal))
    process.loadEnvFile(envLocal);
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('Definir REDIS_URL');
  console.log(
    `Redis: ${new URL(url).host} (${url.startsWith('rediss://') ? 'TLS' : 'sin TLS'})`,
  );
  return new Redis(url);
}
