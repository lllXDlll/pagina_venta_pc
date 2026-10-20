# Sprint 0: Fundamentos (semana 1)

> Contexto previo: `00_parte_tecnica.md`. Implementa solo lo de este documento.

**Objetivo:** entornos conectados, despliegue vacío funcionando, esquema inicial migrado y riesgos técnicos validados.
**Depende de:** nada.
**Prerrequisito (fuera del código):** el dominio `xdtech.store` comprado y su DNS administrado en Cloudflare, más las cuentas de Vercel, Render, Neon, Upstash y GitHub. Es el único elemento del proyecto que no es gratuito.

## HU-36a Base técnica y despliegue vacío
**Como** desarrollador, **quiero** el repositorio, la CI y los servicios conectados, **para** empezar a construir sobre una base estable.

**Tareas**
- Crear monorepo con `apps/web` (Next.js) y `apps/api` (NestJS).
- Configurar Prisma con dos cadenas de conexión (pooler para la app, directa para migraciones).
- Crear `docker-compose.yml` con Postgres y Redis locales.
- Crear la migración inicial con el esquema completo del modelo de datos.
- Módulo `health` con `GET /health` (verifica Postgres y Redis).
- GitHub Actions: instalar, lint, pruebas unitarias e integración (Postgres y Redis como servicios), build.
- Documentar variables de entorno en `.env.example` (incluir `COOKIE_DOMAIN`, `FRONTEND_ORIGIN` para CORS y `SESSION_TTL_DAYS`).
- Configurar el DNS de `xdtech.store` en Cloudflare: frontend en Vercel y `api.xdtech.store` hacia Render (solo DNS, nube gris), ambos con HTTPS válido. Ver sección 2.1 de `00_parte_tecnica.md`.

**Criterios de aceptación**
- `GET /health` responde 200 localmente y en `api.xdtech.store`.
- La migración se aplica en Neon y en Postgres local.
- La CI corre en cada push y pasa.
- El frontend vacío carga por HTTPS en el dominio configurado.

## HU-36b Pruebas de humo de riesgos técnicos
**Como** desarrollador, **quiero** validar los supuestos críticos, **para** no descubrir bloqueos en el sprint de concurrencia.

**Tareas**
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
Despliegue vacío accesible por HTTPS, CI en verde, esquema migrado, riesgos validados y documentados.
