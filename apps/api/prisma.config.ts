import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// En desarrollo, las variables vienen del .env de la raíz del repositorio
const envLocal = resolve(import.meta.dirname, '../../.env');
if (existsSync(envLocal)) process.loadEnvFile(envLocal);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // El CLI (migrate) usa la conexión directa: las migraciones toman advisory locks
  // que el pooler de Neon (PgBouncer en modo transacción) no garantiza.
  // La app usa DATABASE_URL (pooler) desde PrismaService.
  datasource: { url: process.env.DIRECT_URL },
});
