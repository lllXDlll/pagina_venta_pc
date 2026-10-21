# Proposal

**Sprint:** 0 — Fundamentos (semana 1)
**Historias de usuario:** HU-36a (Base técnica y despliegue vacío), HU-36b (Pruebas de humo de riesgos técnicos)

## Why

El repositorio solo contiene documentación: no existe código, CI ni servicios conectados. Todos los sprints posteriores asumen un monorepo funcional, un esquema de base de datos migrado y entornos desplegados. Además, el Sprint 3 (concurrencia) depende de supuestos no verificados —Lua en Upstash, Prisma con el pooler de Neon, cookie entre subdominios e IP real del cliente— que conviene validar ahora y no descubrir como bloqueos en la semana 4.

## What Changes

- Monorepo con `apps/web` (Next.js) y `apps/api` (NestJS, TypeScript estricto), con la estructura de carpetas de `docs/00_parte_tecnica.md` sección 3.
- `docker-compose.yml` con Postgres y Redis locales para desarrollo y pruebas de integración.
- Prisma con dos cadenas de conexión (pooler para la app, directa para migraciones) y tiempo de espera de conexión ajustado al despertar de Neon. **Migración inicial con el esquema completo** del modelo de datos (sección 4), incluida la tabla `sesiones`.
- Módulo `health` con dos endpoints:
  - `GET /health/live`: sin dependencias, siempre 200. Es el que usará el monitor externo para mantener despierto a Render sin tocar Neon ni Upstash.
  - `GET /health/ready`: verifica Postgres y Redis y responde 503 si alguno falla. Solo para CI y uso manual.
- Pipeline de GitHub Actions: instalación, lint, pruebas unitarias, pruebas de integración (Postgres y Redis como servicios) y build, en cada push.
- `.env.example` con todas las variables, incluidas `COOKIE_DOMAIN`, `FRONTEND_ORIGIN` y `SESSION_TTL_DAYS`.
- Despliegue vacío: frontend en Vercel (`app.xdtech.store`) y API en Render (`api.xdtech.store`), DNS en Cloudflare, ambos por HTTPS; base de datos en Neon y Redis en Upstash conectados.
- **Despliegue continuo desde el Sprint 0:** cada push a `main` despliega en Vercel y Render; Render espera a que la CI esté en verde.
- **Migraciones al arrancar:** con `MIGRAR_AL_ARRANCAR=true`, la API aplica las migraciones pendientes en Neon antes de atender tráfico. Así el esquema, que cambiará en cada sprint, nunca queda desfasado del código desplegado. Las migraciones deben ser compatibles hacia atrás (*expand/contract*).
- Pruebas de humo de riesgos técnicos (HU-36b) con endpoints **temporales**, eliminados al terminar. Sus resultados se documentan en el `README.md`: Lua en Upstash, Prisma con pooler, consumo de comandos Redis de una reserva de ejemplo, cookie entre subdominios e IP real del cliente.

**Fuera de alcance** (sprints posteriores):
- Autenticación, sesiones, roles y rate limiting (Sprint 1). La tabla `sesiones` se crea en la migración, pero no hay endpoints de auth. Las pruebas de cookie e IP de este sprint usan endpoints temporales, no la implementación real.
- Catálogo, CRUD y semillas de productos (Sprint 1); semilla de reglas de compatibilidad (Sprint 2).
- Scripts Lua reales de reserva y expiración, reconciliación y k6 (Sprint 3). El script Lua de este sprint es trivial y solo valida la plataforma.
- Configuración del monitor UptimeRobot, prueba de humo en producción y cierre del despliegue (Sprint 7). Este sprint deja listo `/health/live` para ese monitor. Las migraciones al arrancar se adelantan a este sprint porque todos los sprints las necesitan; el Sprint 7 solo las verifica.
- HU-03 (recuperación de acceso) sigue diferida: no se crea la tabla `tokens_recuperacion`.

## Capabilities

### New Capabilities
- `system-health`: endpoints públicos de salud que separan la vida del proceso (`/health/live`, sin dependencias) de la disponibilidad de sus dependencias (`/health/ready`, Postgres y Redis).
- `database-schema`: esquema relacional versionado mediante migraciones, aplicable de forma reproducible en Postgres local y en Neon, y aplicado automáticamente al desplegar.
- `continuous-integration`: verificación automática de cada push (lint, pruebas unitarias e integración, build) como condición de "hecho".
- `deployment-environments`: entornos local y de producción accesibles por HTTPS bajo `xdtech.store`, desplegados de forma continua desde `main`, con configuración por variables de entorno y supuestos de plataforma validados y documentados (Lua, pooler, cookie entre subdominios, IP real).

### Modified Capabilities
<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Código nuevo:** `apps/web`, `apps/api` (módulo `health` y servicios compartidos de Prisma y Redis), `apps/api/prisma/` con el esquema y la migración inicial, `docker-compose.yml`, `.github/workflows/ci.yml`, `.env.example`, `README.md`.
- **Dependencias nuevas:** Next.js, NestJS, Prisma, ioredis, `@nestjs/terminus`, Jest y Supertest, ESLint y Prettier; pnpm como gestor de paquetes con workspaces.
- **Servicios externos:** GitHub (repositorio y Actions), Vercel, Render, Neon, Upstash y Cloudflare (DNS).
- **Prerrequisitos fuera del código:** dominio `xdtech.store` comprado con su DNS en Cloudflare, cuentas creadas en los servicios anteriores y repositorio remoto en GitHub.
