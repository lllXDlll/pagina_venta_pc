# Design

## Context

Proyecto *greenfield*: el repositorio solo tiene `docs/` y `openspec/`. La estructura de carpetas (sección 3), el modelo de datos (sección 4), el stack y los límites de los planes gratuitos (sección 2) están fijados en `docs/00_parte_tecnica.md`. Este diseño concreta las decisiones que esos documentos dejan abiertas. Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`.

Restricciones que condicionan el enfoque:
- **Neon:** 100 CU-hours al mes; suspende el cómputo tras 5 min sin actividad. Cualquier consulta periódica impide la suspensión. Expone dos endpoints: pooler (PgBouncer en modo transacción) y conexión directa.
- **Render:** se duerme tras 15 min sin tráfico (~1 min en despertar) y bloquea los puertos SMTP salientes.
- **Upstash:** 500K comandos al mes.
- Un solo desarrollador y una semana: se prioriza lo mínimo que deja la base estable.

Este cambio no toca stock, reservas ni pagos: solo crea sus tablas. Las reglas de la sección 5 se implementan en el Sprint 3; aquí solo se garantiza que el esquema las soporte (versión en `stock`, unicidad de la clave de idempotencia).

## Goals / Non-Goals

**Goals:**
- Monorepo que compila, pasa lint y pruebas, y se despliega vacío en Vercel y Render.
- Esquema completo migrado en local y en Neon, con las restricciones que necesitan los sprints 1 a 4.
- Salud separada en vida (`live`) y disponibilidad (`ready`), para que el monitor del Sprint 7 no consuma recursos de Neon ni de Upstash.
- Riesgos de plataforma convertidos en hechos documentados (OK o no OK) antes del Sprint 1.

- Despliegue continuo desde `main` con migraciones automáticas, para que el esquema, que cambiará en cada sprint, nunca quede desfasado del código.

**Non-Goals:**
- Configurar UptimeRobot (Sprint 7).
- Entornos de *staging* o una base de Neon por rama: hay un solo entorno de producción.
- Pruebas del frontend más allá de lint y build: aún no hay comportamiento que probar.
- Turborepo, Nx u otra herramienta de orquestación del monorepo.

## Decisions

### D1. Monorepo con pnpm workspaces
`pnpm-workspace.yaml` con `apps/*` y scripts raíz (`lint`, `test`, `test:e2e`, `build`) que delegan con `pnpm -r`. Node en la versión LTS vigente, fijada en `.nvmrc` y en `engines`.
- *Alternativas:* npm workspaces (más lento y con *hoisting* menos estricto); Turborepo (caché útil, pero es una pieza más que configurar en Vercel, Render y CI para solo dos apps).

### D2. Frontend en `app.xdtech.store`
El dominio raíz `xdtech.store` redirige a `app.xdtech.store` mediante una redirección de Vercel. Así la configuración coincide con el Sprint 7 (cookie compartida entre `app.` y `api.`) y el registro del dominio raíz no depende del *CNAME flattening* de Cloudflare.
- *Alternativa:* servir el frontend en el dominio raíz. Funciona igual para la cookie, pero complica el DNS sin aportar nada.

### D3. Prisma: pooler para la app, conexión directa para migrar y espera de conexión ampliada
- `DATABASE_URL` apunta al pooler de Neon, con los parámetros que exija la versión estable vigente de Prisma para PgBouncer en modo transacción, y la usa la app.
- `DIRECT_URL` apunta a la conexión directa y solo la usa `prisma migrate`.
- En local, ambas apuntan al Postgres de Docker. Se declaran con el mecanismo de la versión de Prisma instalada (`directUrl` en el *datasource* o su equivalente en `prisma.config.ts`).
- **Despertar de Neon:** `connect_timeout` de la cadena del pooler configurable, con un valor por defecto de 30 s, holgado frente a los pocos segundos que tarda Neon en despertar. Así la primera petición tras la suspensión espera en lugar de fallar.
- *Por qué la conexión directa para migrar:* las migraciones usan *advisory locks* y sesiones largas que PgBouncer en modo transacción no garantiza.

### D4. Convenciones del esquema
- Modelos Prisma en PascalCase, mapeados a las tablas en español y snake_case de la sección 4 (`@@map`, `@map`).
- Identificadores UUID; importes en `Decimal(12,2)`, nunca `float`.
- Enumeraciones nativas de Postgres: `Rol`, `TipoProducto`, `OrigenConfiguracion`, `EstadoReserva` (ACTIVA, CONFIRMADA, EXPIRADA) y el estado de la configuración.
- `stock.version Int @default(0)`; `ordenes.clave_idempotencia @unique`; `usuarios.correo @unique`; `sesiones.token_hash @unique` con índices por `usuario_id` y por `vence_en` (para la limpieza del Sprint 1).
- `reservas` con índice por `(estado, vence_en)` para la expiración y la reconciliación del Sprint 3.
- `carrito_items` admite un producto **o** una configuración: dos FK opcionales y una restricción `CHECK` (exactamente una no nula) añadida a mano en el SQL de la migración, porque Prisma no la expresa.
- No se crea `tokens_recuperacion` (HU-03 diferida).
- *Alternativa descartada:* IDs autoincrementales. Los UUID evitan exponer volúmenes de venta en las URLs. El número correlativo del comprobante es una columna aparte (Sprint 4).

### D5. Salud con `@nestjs/terminus`, separada en `live` y `ready`
- `GET /health/live`: controlador sin dependencias inyectadas que devuelve 200 y `{ "status": "ok" }`. No usa Terminus ni toca Prisma ni Redis, de modo que el monitor del Sprint 7 no despierta a Neon ni gasta comandos de Upstash.
- `GET /health/ready`: Terminus con un indicador de Prisma (`SELECT 1`) y uno de Redis (`PING`), cada uno con su tiempo límite. Terminus ya responde 200 o 503 con el detalle por dependencia; la respuesta de error no incluye mensajes de conexión crudos.
- No existe `GET /health` a secas, para evitar que alguien apunte el monitor a un endpoint ambiguo.
- *Alternativa descartada:* un único `/health` con dependencias. Es lo que pedía la versión anterior de los documentos, pero con un monitor cada 5 min agotaría las 100 CU-hours de Neon en unos 16 días.

### D6. Cliente Redis compartido
Un `RedisModule` global provee una instancia de ioredis configurada desde `REDIS_URL` (`rediss://` con TLS en Upstash, `redis://` en local). Lo reutilizan la salud ahora y las reservas en el Sprint 3. La conexión es perezosa (`lazyConnect`) para que `/health/live` responda aunque Redis no esté disponible.

### D7. CI en GitHub Actions
Un único workflow `ci.yml`, en cada push y en los PR a `main`, que:
1. instala con caché de pnpm;
2. ejecuta el lint;
3. aplica `prisma migrate deploy` contra el servicio Postgres del job;
4. corre las pruebas unitarias y las e2e o de integración de `apps/api` (Jest y Supertest) contra los servicios `postgres` y `redis` del job;
5. compila ambas apps.

Las variables de CI apuntan solo a esos servicios.

### D8. Despliegue continuo
```
 push a main --> GitHub Actions (CI) --verde--> Render: build -> start.sh -> node dist/main
            \
             +--> Vercel: build apps/web -> app.xdtech.store
```
- **Vercel:** proyecto con *root directory* `apps/web`, conectado al repositorio, y los dominios `app.xdtech.store` y `xdtech.store` (este último redirige). Cada push a `main` despliega a producción; las demás ramas generan previews.
- **Render:** *web service* Node desde la raíz del monorepo, conectado al repositorio con *auto-deploy* "después de que pasen los checks de CI". Compila `apps/api` y arranca con el script de inicio de D11. Dominio personalizado `api.xdtech.store`; *health check path* `/health/live`.
- **Cloudflare:** CNAME `api` → Render en modo solo DNS (nube gris). Los registros de Vercel también van en nube gris en este sprint; la opción de nube naranja se evalúa en el Sprint 7.
- **Previews de Vercel:** viven en `*.vercel.app`, fuera de `xdtech.store`. La cookie no viaja y CORS no las admite, así que sirven para revisar la interfaz pero no para iniciar sesión. Se acepta: hay un solo entorno de API.
- *Alternativa descartada:* desplegar solo al final (Sprint 7). Deja los problemas de despliegue para la última semana.

### D11. Migraciones al arrancar la API
- El comando de inicio en Render es un script (`apps/api/scripts/start.sh`) que, si `MIGRAR_AL_ARRANCAR=true`, ejecuta `prisma migrate deploy` con `DIRECT_URL` y solo después `node dist/main`. Si la migración falla, el script termina con error (`set -e`) y la API no arranca.
- En Render `MIGRAR_AL_ARRANCAR=true`; en local y en CI queda en `false` (allí se migra explícitamente).
- Si una versión no arranca, Render no la pone en servicio y la anterior sigue atendiendo. Esto se **verifica** en el Sprint 0 (tarea 6.5) en lugar de darlo por supuesto.
- `prisma migrate deploy` toma un *advisory lock*, así que dos arranques simultáneos no aplicarían la misma migración dos veces (con una sola instancia no debería pasar).
- **Regla *expand/contract*:** durante el despliegue la versión vieja atiende sobre el esquema nuevo. Las migraciones solo agregan (tablas, columnas opcionales o con valor por defecto, índices). Renombrar o eliminar se hace en dos despliegues: primero el código deja de usarlo y después se elimina.
- *Alternativas descartadas:* migrar a mano antes de cada push (fácil de olvidar en 7 sprints); migrar desde la CI (obliga a guardar la `DIRECT_URL` de producción como *secret* de GitHub, en contra del requisito de CI sin credenciales de producción); el *pre-deploy command* de Render (no está disponible en el plan gratuito).

### D9. Validaciones de HU-36b aisladas en un módulo temporal
- Los endpoints temporales (`/diagnostico/cookie` y `/diagnostico/ip`) viven en un módulo `diagnostico` que solo se registra si `DIAGNOSTICO_HABILITADO=true`, y se eliminan en un commit propio al terminar.
- Los scripts de prueba que no necesitan HTTP (Lua trivial, conteo de comandos) van en `apps/api/scripts/smoke/` y se ejecutan con `tsx`.
- **Conteo de comandos:** se mide con `INFO commandstats` en Redis local y con las métricas de la consola de Upstash, para una reserva de ejemplo de tres productos implementada como un único `EVAL`.
- **IP real:** `app.set('trust proxy', n)` sobre el adaptador Express, con `n` configurable (`TRUST_PROXY_HOPS`); se ajusta según lo que muestre `/diagnostico/ip`.
- **CORS:** `origin` = `FRONTEND_ORIGIN` y `credentials: true`, nunca un comodín. Queda como configuración definitiva para el Sprint 1.

### D10. Herramientas de calidad
ESLint y Prettier compartidos en la raíz; `strict: true` en los `tsconfig` de ambas apps.

## Risks / Trade-offs

- **[Prisma + PgBouncer] Errores de sentencias preparadas con el pooler.** → Es justo lo que valida HU-36b. Si falla, se documenta la configuración correcta o se usa la conexión directa con un límite bajo de conexiones.
- **[Neon] La primera petición tras la suspensión es lenta (despertar de Render más despertar de Neon).** → `connect_timeout` holgado (D3); antes de la demo se calienta el sistema con una petición a `/health/ready`.
- **[Upstash] Las pruebas de HU-36b gastan cuota.** → Se ejecutan pocas veces; los experimentos repetidos van contra Redis local.
- **[DNS] Propagación o emisión de certificados lenta en Render y Vercel.** → Configurar el DNS el primer día del sprint.
- **[Render] El arranque en frío (~1 min) hace parecer fallidas las primeras peticiones de las pruebas.** → Despertar el servicio con `/health/live` antes de las validaciones de cookie e IP.
- **[Esquema] Crear el esquema completo en el Sprint 0 puede requerir ajustes en sprints posteriores.** → Se aceptan migraciones incrementales, aplicadas solas al desplegar (D11); la migración inicial nunca se edita una vez aplicada en Neon.
- **[Migraciones] Una migración que falla en Neon deja la versión nueva sin arrancar.** → Render mantiene la anterior (se verifica en la tarea 6.5); la CI ya aplicó la misma migración sobre una base limpia, lo que detecta la mayoría de errores antes del despliegue.
- **[Migraciones] Una migración destructiva rompe la versión vieja durante el despliegue.** → Regla *expand/contract* (D11).
- **[Migraciones] Revertir el código no revierte el esquema.** → Como las migraciones solo agregan, el código anterior sigue funcionando sobre el esquema nuevo; no se escriben migraciones de bajada.
- **[Neon] Cada arranque de la API consulta Neon para migrar y lo despierta.** → Coste despreciable: solo ocurre en despliegues y reinicios, no de forma periódica.

## Migration Plan

No hay datos previos ni usuarios, así que no hay migración ni *rollback* de datos. La primera migración en Neon ocurre en el primer despliegue de la API (D11). Para revertir un despliegue basta con volver a desplegar el commit anterior en Vercel o Render; el esquema se queda como está, lo que es seguro por la regla *expand/contract*. Si la migración inicial necesita rehacerse antes del Sprint 1, se puede reiniciar la base de Neon, que está vacía.
