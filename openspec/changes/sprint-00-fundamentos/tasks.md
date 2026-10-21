# Tasks

> Prerrequisitos fuera del código (no rastreados): dominio `xdtech.store` comprado con DNS en Cloudflare; cuentas en GitHub, Vercel, Render, Neon y Upstash; repositorio remoto en GitHub conectado.

## 1. Monorepo y herramientas

- [x] 1.1 Crear `package.json` raíz, `pnpm-workspace.yaml` (`apps/*`), `.nvmrc` y `engines`; verificar que `pnpm install` termina sin errores
- [x] 1.2 Generar `apps/api` con NestJS (TypeScript `strict: true`) siguiendo las carpetas de la sección 3 (solo `health/` por ahora); verificar que `pnpm --filter api build` compila
- [x] 1.3 Generar `apps/web` con Next.js (TypeScript estricto) con una página inicial vacía; verificar que `pnpm --filter web build` compila
- [x] 1.4 Configurar ESLint y Prettier compartidos y los scripts raíz `lint`, `test`, `test:e2e` y `build`; verificar que `pnpm lint` y `pnpm build` pasan en la raíz

## 2. Entorno local y configuración

- [x] 2.1 Crear `docker-compose.yml` con Postgres y Redis (puertos y credenciales de desarrollo); verificar con `docker compose up -d` que ambos servicios quedan *healthy*
- [x] 2.2 Crear `.env.example` con `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `COOKIE_DOMAIN`, `FRONTEND_ORIGIN`, `SESSION_TTL_DAYS`, `TRUST_PROXY_HOPS`, `DIAGNOSTICO_HABILITADO`, `MIGRAR_AL_ARRANCAR` (`false` en local) y `PORT`, con valores locales de ejemplo; verificar que, copiado a `.env`, la API arranca contra Docker
- [x] 2.3 Añadir validación de variables de entorno al arrancar la API (falla con un mensaje claro si falta alguna); verificar con una prueba unitaria que una variable ausente aborta el arranque

## 3. Esquema de base de datos

- [x] 3.1 Configurar Prisma en `apps/api/prisma/` con `DATABASE_URL` (pooler, con `connect_timeout` configurable y 30 s por defecto) para la app y `DIRECT_URL` para migraciones (D3); verificar que `prisma validate` pasa
- [x] 3.2 Modelar todas las tablas de la sección 4 con las convenciones de D4 (UUID, `Decimal`, enums, `@@map`, `stock.version`, unicidades e índices), sin `tokens_recuperacion`; verificar con `prisma format` y `prisma validate`
- [x] 3.3 Generar la migración inicial y añadir a mano el `CHECK` de `carrito_items` (producto **o** configuración); verificar que `prisma migrate deploy` la aplica sobre el Postgres de Docker vacío
- [x] 3.4 Escribir pruebas de integración del esquema contra el Postgres de Docker: existen todas las tablas, no existe `tokens_recuperacion`, y se rechazan un correo duplicado, una clave de idempotencia duplicada y un `carrito_item` con ambas FK nulas; verificar que pasan con `pnpm test:e2e`
- [x] 3.5 Crear `PrismaService` (módulo de base de datos) en la API; verificar con las pruebas de `/health/ready` del grupo 4 que la conexión funciona
- [x] 3.6 Crear `apps/api/scripts/start.sh` (D11): con `MIGRAR_AL_ARRANCAR=true` ejecuta `prisma migrate deploy` con `DIRECT_URL` y luego `node dist/main`; termina con error si la migración falla. Verificar contra el Postgres de Docker los tres casos: con migración pendiente la aplica y arranca; con la variable en `false` arranca sin migrar; con una migración rota termina con código distinto de cero sin arrancar
- [x] 3.7 Documentar en `README.md` la regla *expand/contract* (las migraciones solo agregan; renombrar o eliminar en dos despliegues) y cómo crear una migración nueva; verificar que el README lo explica

## 4. Módulo de salud

- [x] 4.1 Crear un `RedisModule` global con ioredis desde `REDIS_URL` (TLS con `rediss://`, `lazyConnect`) (D6); verificar con una prueba de integración que hace `PING` al Redis de Docker
- [x] 4.2 Implementar `GET /health/live` sin dependencias inyectadas (D5); verificar con una prueba e2e que responde 200 aunque Postgres y Redis estén inaccesibles y que no ejecuta consultas ni comandos (dependencias simuladas sin llamadas)
- [x] 4.3 Implementar `GET /health/ready` con `@nestjs/terminus` e indicadores de Prisma y Redis con tiempo límite (D5); verificar a mano que responde 200 en local
- [x] 4.4 Escribir las pruebas e2e de `/health/ready`: 200 con ambas dependencias disponibles, y 503 que nombra la dependencia caída sin exponer cadenas de conexión (simulando Redis o Postgres inaccesibles); verificar que pasan con `pnpm test:e2e`
- [x] 4.5 Añadir una prueba unitaria de cada indicador de salud con dependencias simuladas; verificar que pasa con `pnpm test`
- [x] 4.6 Documentar en `README.md` los dos endpoints de salud y la regla de que el monitor externo usa solo `/health/live` (motivo: las 100 CU-hours de Neon y la cuota de Upstash); verificar que el README lo explica

## 5. Integración continua

- [x] 5.1 Crear `.github/workflows/ci.yml` (en cada push y en los PR a `main`) con caché de pnpm, lint, `prisma migrate deploy`, pruebas unitarias, pruebas de integración con los servicios `postgres` y `redis`, y build de ambas apps (D7); verificar con un push que la ejecución termina en verde
- [x] 5.2 Comprobar que la CI falla ante errores: hacer push en una rama de prueba con un error de lint deliberado y verificar que la ejecución termina en rojo indicando la etapa; luego borrar la rama
- [x] 5.3 Revisar que `ci.yml` no contiene credenciales de Neon, Upstash ni de otros servicios de producción, y verificarlo buscando esas cadenas en el repositorio

## 6. Despliegue vacío

- [ ] 6.1 Crear la base en Neon (obtener las cadenas de pooler y directa) y la instancia en Upstash; verificar que ambas aceptan conexiones desde la PC local
- [ ] 6.2 Crear el servicio de Render conectado al repositorio (D8) con las variables de producción (`MIGRAR_AL_ARRANCAR=true`), comando de inicio `start.sh`, *health check path* `/health/live`, dominio `api.xdtech.store` (CNAME en solo DNS) y *auto-deploy* después de los checks de CI. Verificar que el primer despliegue aplica la migración inicial en Neon (`prisma migrate status` sin pendientes) y que `https://api.xdtech.store/health/live` y `/health/ready` responden 200 con certificado válido
- [ ] 6.3 Verificar el despertar de Neon: tras más de 5 min sin peticiones a Postgres, llamar a `/health/ready` y comprobar que responde 200 (anotar la latencia en el README)
- [ ] 6.4 Crear el proyecto de Vercel conectado al repositorio (*root directory* `apps/web`) con `app.xdtech.store` y la redirección desde `xdtech.store`; verificar que `https://app.xdtech.store` carga sin advertencias de certificado y que el dominio raíz redirige
- [ ] 6.5 Verificar el despliegue continuo: (a) un push a `main` con CI en verde despliega solo en Vercel y Render; (b) un push con CI en rojo no despliega en Render; (c) una migración deliberadamente rota hace fallar el arranque y Render mantiene la versión anterior atendiendo. Revertir la migración rota y anotar los tres resultados en el README

## 7. Validación de riesgos técnicos (HU-36b)

- [x] 7.1 Crear el módulo temporal `diagnostico`, condicionado a `DIAGNOSTICO_HABILITADO`, con `/diagnostico/cookie` (emite una cookie `httpOnly; Secure; SameSite=Lax; Domain=.xdtech.store` y la devuelve si la recibe) y `/diagnostico/ip` (devuelve `req.ip` y los encabezados de proxy); configurar CORS con `FRONTEND_ORIGIN` y credenciales, y `trust proxy` con `TRUST_PROXY_HOPS` (D9). Verificar en local que ambos endpoints responden
- [ ] 7.2 Añadir en `apps/web` una página temporal que llame a los endpoints de diagnóstico con `credentials: 'include'`; verificar en producción que la cookie vuelve a la API en Chrome y en Safari o Firefox
- [ ] 7.3 Llamar a `/diagnostico/ip` en producción desde una conexión real y comparar con la IP pública del cliente; ajustar `TRUST_PROXY_HOPS` o el encabezado leído hasta obtener la IP real, y verificar el resultado
- [ ] 7.4 Ejecutar el script Lua trivial de `apps/api/scripts/smoke/` contra Upstash; verificar que devuelve el resultado esperado
- [ ] 7.5 Verificar que Prisma opera a través del pooler de Neon desde Render (lecturas y escrituras repetidas sin errores de sentencias preparadas) y registrar el resultado
- [ ] 7.6 Medir los comandos que consume una reserva de ejemplo de tres productos implementada como un único `EVAL` (`INFO commandstats` en local y métricas de Upstash); verificar que el número y la estimación sobre los 500K comandos mensuales quedan anotados
- [ ] 7.7 Documentar en `README.md` los resultados OK o no OK (Lua en Upstash, Prisma con pooler, cookie entre subdominios con los navegadores probados, IP real con el ajuste aplicado), el consumo de comandos y, ante cualquier no OK, la alternativa decidida; verificar que el README cubre cada punto
- [ ] 7.8 Eliminar el módulo `diagnostico`, la página temporal y `DIAGNOSTICO_HABILITADO` en un commit propio; verificar que los endpoints responden 404 en producción tras volver a desplegar

## 8. Cierre del sprint

- [x] 8.1 Completar `README.md` con las instrucciones de arranque local (`docker compose up -d`, `.env`, migración, `pnpm dev`); verificar siguiéndolas desde un clon limpio
- [ ] 8.2 Verificar la definición de hecho del Sprint 0: despliegue vacío accesible por HTTPS (`app.` y `api.`) y desplegado de forma continua desde `main`, CI en verde, esquema migrado en local y en Neon (en Neon, por el arranque de la API), y riesgos validados y documentados en el README

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` una vez revisado y con la CI en verde en `main`.
