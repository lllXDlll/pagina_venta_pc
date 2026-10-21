# Sprint 0: Fundamentos (semana 1)

> Contexto previo: `00_parte_tecnica.md`. Implementa solo lo de este documento.

**Objetivo:** entornos conectados, despliegue vacío funcionando, esquema inicial migrado y riesgos técnicos validados.
**Depende de:** nada.
**Prerrequisito (fuera del código):** el dominio `xdtech.store` comprado y su DNS administrado en Cloudflare, más las cuentas de Vercel, Render, Neon, Upstash y GitHub. Es el único elemento del proyecto que no es gratuito.

## HU-36a Base técnica y despliegue vacío
**Como** desarrollador, **quiero** el repositorio, la CI y los servicios conectados, **para** empezar a construir sobre una base estable.

**Tareas**
- Crear monorepo con pnpm workspaces, `apps/web` (Next.js) y `apps/api` (NestJS), con ESLint y Prettier compartidos.
- Configurar Prisma con dos cadenas de conexión (pooler para la app, con `connect_timeout` de 30 s por defecto; directa para migraciones).
- Crear `docker-compose.yml` con Postgres y Redis locales.
- Crear la migración inicial con el esquema completo del modelo de datos, según las convenciones de la sección 4 de `00_parte_tecnica.md` (incluido el `CHECK` de `carrito_items`).
- Crear `apps/api/scripts/start.sh`: si `MIGRAR_AL_ARRANCAR=true`, aplica las migraciones pendientes con la conexión directa y luego arranca la API; si la migración falla, no arranca. Documentar en el README la regla *expand/contract*.
- Módulo `health` con dos endpoints: `GET /health/live` (sin dependencias, responde 200; es el que usará el monitor externo) y `GET /health/ready` (verifica Postgres y Redis; responde 503 si alguno falla; solo para CI y uso manual). Ver sección 2 de `00_parte_tecnica.md`.
- GitHub Actions: instalar, lint, pruebas unitarias e integración (Postgres y Redis como servicios), build.
- Documentar variables de entorno en `.env.example` (incluir `COOKIE_DOMAIN`, `FRONTEND_ORIGIN` para CORS, `SESSION_TTL_DAYS`, `TRUST_PROXY_HOPS` y `MIGRAR_AL_ARRANCAR`) y validarlas al arrancar la API.
- Configurar el DNS de `xdtech.store` en Cloudflare: frontend en Vercel (`app.xdtech.store`, con el dominio raíz redirigiendo a él) y `api.xdtech.store` hacia Render (solo DNS, nube gris), ambos con HTTPS válido. Ver sección 2.1 de `00_parte_tecnica.md`.
- Configurar el despliegue continuo: Vercel y Render conectados al repositorio; Render despliega solo después de que la CI pase, arranca con `start.sh` (`MIGRAR_AL_ARRANCAR=true`) y usa `/health/live` como *health check path*.

**Criterios de aceptación**
- `GET /health/live` responde 200 localmente y en `api.xdtech.store`, incluso con Postgres y Redis caídos.
- `GET /health/ready` responde 200 con ambos servicios activos y 503 si alguno falla.
- La migración se aplica en Postgres local y en Neon (en Neon, al arrancar la API desplegada).
- La CI corre en cada push y pasa, sin credenciales de producción.
- El frontend vacío carga por HTTPS en `app.xdtech.store`.
- Un push a `main` con CI en verde despliega en Vercel y Render; con CI en rojo, Render no despliega.
- Una migración que falla impide arrancar la versión nueva y Render mantiene la anterior atendiendo (se prueba con una migración deliberadamente rota y luego se revierte).

## HU-36b Pruebas de humo de riesgos técnicos
**Como** desarrollador, **quiero** validar los supuestos críticos, **para** no descubrir bloqueos en el sprint de concurrencia.

**Tareas**
- Los endpoints temporales de esta historia viven en un módulo `diagnostico` que solo se registra con `DIAGNOSTICO_HABILITADO=true` y se elimina en un commit propio al terminar. Los scripts sin HTTP (Lua, conteo de comandos) van en `apps/api/scripts/smoke/`.
- Ejecutar un script Lua trivial en Upstash y confirmar que funciona.
- Confirmar que Prisma opera correctamente con el pooler de Neon.
- Medir los comandos de Redis consumidos por una operación de reserva de ejemplo.
- Probar la cookie entre subdominios: un endpoint temporal de `api.xdtech.store` emite una cookie `httpOnly; Secure; SameSite=Lax; Domain=.xdtech.store` y una petición con credenciales desde el frontend la envía de vuelta (CORS con credenciales solo para el origen del frontend). Eliminar el endpoint al terminar la prueba.
- Con `trust proxy` configurado, comprobar que la API ve la IP real del cliente y no la del proxy de Render (endpoint temporal que devuelve `req.ip`, desde una conexión real a `api.xdtech.store`). De ello depende el límite de peticiones por IP.

**Criterios de aceptación**
- Resultado documentado en el README: Lua en Upstash OK/no OK, Prisma con pooler OK/no OK, cookie entre subdominios OK/no OK (probada al menos en Chrome y Safari o Firefox), IP real del cliente OK/no OK.
- Si la cookie entre subdominios falla, se documenta y se decide la alternativa antes del Sprint 1.
- Si la API no ve la IP real del cliente, se ajusta `trust proxy` (Render puede tener más de un proxy delante, así que probar con el número de saltos correcto) o se lee otro encabezado (`X-Forwarded-For`, `X-Real-IP`), y se documenta el ajuste antes del Sprint 1.
- Si Lua no funciona en Upstash, se documenta la alternativa (Redis local o ajuste del plan) antes de seguir.

## Definición de hecho del sprint
Despliegue vacío accesible por HTTPS (`app.` y `api.`) y desplegado de forma continua desde `main`, CI en verde, esquema migrado en local y en Neon, riesgos validados y documentados.
