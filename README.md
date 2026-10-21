# XD Tech: venta de PCs y componentes

Plataforma web de venta de computadoras y componentes, con armador manual, asistente de IA y motor de reglas de compatibilidad. El punto crítico es la concurrencia: 300 usuarios simultáneos sobre stock limitado sin sobreventa.

La documentación del proyecto está en [`docs/`](docs/): primero [`00_parte_tecnica.md`](docs/00_parte_tecnica.md) y luego el sprint en curso.

| Pieza                | Tecnología           | Producción                 |
| -------------------- | -------------------- | -------------------------- |
| Frontend             | Next.js (`apps/web`) | Vercel, `app.xdtech.store` |
| API                  | NestJS (`apps/api`)  | Render, `api.xdtech.store` |
| Base de datos        | PostgreSQL + Prisma  | Neon                       |
| Caché / concurrencia | Redis (ioredis)      | Upstash                    |

## Arranque local

Requisitos: Node 24 (`.nvmrc`), pnpm 10 (`corepack enable` o `corepack pnpm ...`) y Docker.

```sh
pnpm install                 # instala dependencias y genera el cliente de Prisma
docker compose up -d --wait  # Postgres (5432) y Redis (6379)
cp .env.example .env         # valores locales listos para Docker
pnpm --filter api db:migrate # aplica las migraciones al Postgres local
pnpm dev                     # web en http://localhost:3000, API en http://localhost:3001
```

Comprobación rápida: `curl http://localhost:3001/health/ready` debe responder 200.

| Comando (raíz)  | Qué hace                                                               |
| --------------- | ---------------------------------------------------------------------- |
| `pnpm lint`     | ESLint en ambas apps (configuración compartida en `eslint.config.mjs`) |
| `pnpm test`     | Pruebas unitarias (`*.spec.ts` junto a cada módulo)                    |
| `pnpm test:e2e` | Pruebas e2e e integración contra el Postgres y el Redis de Docker      |
| `pnpm build`    | Compila ambas apps                                                     |
| `pnpm format`   | Prettier                                                               |

## Variables de entorno

Todas están en [`.env.example`](.env.example), con valores de ejemplo para el entorno local. La API valida las suyas al arrancar y no arranca si falta alguna. Nunca versionar `.env`.

## Endpoints de salud

| Endpoint            | Qué verifica                                                                                                               | Quién lo usa                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /health/live`  | Solo que el proceso está vivo. No toca Postgres ni Redis.                                                                  | Monitor externo (UptimeRobot, cada 5 min) y _health check_ de Render |
| `GET /health/ready` | Postgres (`SELECT 1`) y Redis (`PING`). 200 si ambos responden; 503 indicando cuál falló, sin exponer cadenas de conexión. | CI y uso manual                                                      |

**El monitor externo usa solo `/health/live`.** Si consultara `/health/ready` cada 5 minutos:

- Neon no podría suspender el cómputo (se suspende tras 5 min sin actividad) y se agotarían las **100 CU-hours mensuales** del plan gratuito en unos 16 días.
- Cada consulta gastaría comandos de la cuota de **500K comandos mensuales** de Upstash, que se reserva para stock y reservas.

No existe `GET /health` a secas, para que nadie configure el monitor contra un endpoint ambiguo.

Tras un rato sin tráfico, la primera petición que consulta Postgres despierta a Neon. La conexión espera hasta `connect_timeout` (30 s por defecto, configurable en `DATABASE_URL`), así que esa petición tarda más pero no falla.

## Migraciones

El esquema está en `apps/api/prisma/schema.prisma` y las migraciones en `apps/api/prisma/migrations/`. Prisma migra con `DIRECT_URL` (conexión directa) y la app usa `DATABASE_URL` (en producción, el pooler de Neon).

**Crear una migración nueva** (con el Postgres de Docker levantado):

```sh
# 1. Editar apps/api/prisma/schema.prisma
pnpm --filter api db:migrate:dev --name descripcion_del_cambio
# 2. Revisar el SQL generado en apps/api/prisma/migrations/<fecha>_descripcion_del_cambio/
# 3. Hacer commit del esquema y de la carpeta de la migración
```

Si hace falta SQL que Prisma no expresa (por ejemplo un `CHECK`), se crea con `--create-only`, se edita el SQL y después se aplica con `pnpm --filter api db:migrate`. Una migración ya aplicada en Neon nunca se edita.

**En producción las migraciones se aplican solas al desplegar.** El comando de inicio de Render es `sh apps/api/scripts/start.sh`: con `MIGRAR_AL_ARRANCAR=true` ejecuta `prisma migrate deploy` y solo después arranca la API. Si la migración falla, la versión nueva no arranca y Render mantiene la anterior. En local y en CI la variable vale `false` y se migra explícitamente.

### Regla _expand/contract_

Durante un despliegue la versión anterior de la API sigue atendiendo sobre el esquema **nuevo**, así que toda migración debe ser compatible hacia atrás:

- **Las migraciones solo agregan:** tablas, columnas opcionales o con valor por defecto, índices y valores de enumeración.
- **Renombrar o eliminar se hace en dos despliegues:** primero se despliega código que deja de usar la columna o tabla (_expand_); en un despliegue posterior, una migración la elimina (_contract_). Para renombrar: agregar la nueva, copiar los datos, pasar el código a la nueva y eliminar la vieja después.
- No se escriben migraciones de bajada: revertir un despliegue es volver a desplegar el commit anterior, que sigue funcionando sobre el esquema nuevo.

## Despliegue continuo

Cada push a `main` despliega el frontend en Vercel y la API en Render; Render espera a que la CI de ese commit esté en verde. Las otras ramas generan previews de Vercel en `*.vercel.app`, que sirven para revisar la interfaz pero no para iniciar sesión (la cookie y CORS solo admiten `xdtech.store`).

### Configuración de los servicios

**Render** (_web service_, runtime Node, rama `main`):

- _Root directory:_ raíz del repositorio (vacío).
- _Build command:_ `corepack enable && pnpm install --frozen-lockfile && pnpm --filter api build`
- _Start command:_ `sh apps/api/scripts/start.sh`
- _Health check path:_ `/health/live`
- _Auto-deploy:_ "After CI checks pass".
- Variables: `DATABASE_URL` (pooler de Neon, con `sslmode=require&connect_timeout=30`), `DIRECT_URL` (conexión directa de Neon), `REDIS_URL` (`rediss://` de Upstash), `COOKIE_DOMAIN=.xdtech.store`, `FRONTEND_ORIGIN=https://app.xdtech.store`, `SESSION_TTL_DAYS=7`, `TRUST_PROXY_HOPS=1`, `MIGRAR_AL_ARRANCAR=true` y, solo durante las pruebas de humo, `DIAGNOSTICO_HABILITADO=true`.
- Dominio personalizado `api.xdtech.store`.

**Vercel:** _root directory_ `apps/web`, dominios `app.xdtech.store` y `xdtech.store` (este último redirige a `app.`), variable `NEXT_PUBLIC_API_URL=https://api.xdtech.store`.

**Cloudflare (DNS):** CNAME `api` → Render y los registros que indique Vercel, todos en modo solo DNS (nube gris).

## Validación de riesgos técnicos (Sprint 0, HU-36b)

> Pendiente: se completa al ejecutar las pruebas de humo contra los servicios reales.

| Supuesto                                                                                          | Resultado | Notas                 |
| ------------------------------------------------------------------------------------------------- | --------- | --------------------- |
| Lua en Upstash                                                                                    | Pendiente |                       |
| Prisma con el pooler de Neon                                                                      | Pendiente |                       |
| Consumo de comandos Redis de una reserva de ejemplo                                               | Pendiente |                       |
| Cookie entre `app.` y `api.`                                                                      | Pendiente | Navegadores probados: |
| IP real del cliente en la API                                                                     | Pendiente | `TRUST_PROXY_HOPS` =  |
| Despertar de Neon (`/health/ready` tras más de 5 min)                                             | Pendiente | Latencia:             |
| Despliegue continuo (CI verde despliega, CI roja no, migración rota mantiene la versión anterior) | Pendiente |                       |
