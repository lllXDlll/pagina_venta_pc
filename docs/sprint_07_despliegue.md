# Sprint 7: Despliegue final y cierre (semana 8)

> Contexto previo: `00_parte_tecnica.md`. Implementa solo lo de este documento.

**Objetivo:** sistema en línea, demo ensayada y documentación final.
**Depende de:** Sprint 6 (sistema completo y probado).

## HU-36c Despliegue final
**Como** desarrollador, **quiero** el sistema desplegado en los servicios gratuitos, **para** presentarlo en línea.

**Criterios de aceptación**
- Frontend en Vercel (`app.xdtech.store`; `xdtech.store` redirige a él), API en Render (`api.xdtech.store`), base de datos en Neon y Redis en Upstash, todo accesible por HTTPS.
- DNS en Cloudflare según la sección 2.1 de `00_parte_tecnica.md`: `api.` en solo DNS; para el frontend, nube gris o, si se usa nube naranja, SSL "Full (strict)" y sin caché para `/api/*` ni para respuestas con `Set-Cookie`.
- Registro, inicio y cierre de sesión funcionan en producción entre `app.` y `api.` con la cookie `Domain=.xdtech.store`, en al menos dos navegadores.
- El despliegue continuo desde `main` y las migraciones al arrancar (`MIGRAR_AL_ARRANCAR`), configurados en el Sprint 0, siguen funcionando; todas las migraciones de los sprints 1 a 6 respetaron la regla *expand/contract*.
- Un monitor externo (UptimeRobot, cada 5 min) consulta **solo `GET /health/live`** para mitigar el arranque en frío de Render. No debe apuntar a `/health/ready`: consultaría Postgres y Redis, impediría que Neon se suspenda (agotando sus 100 CU-hours mensuales) y gastaría comandos de Upstash.
- El README documenta esta decisión y los límites vigentes de Neon, Upstash y Render.
- Se confirman los límites vigentes de los planes gratuitos antes de la demo.
- Se mantiene la opción de ejecutar todo con Docker local como plan de respaldo.

**Tareas:** configurar variables de entorno en cada servicio (`COOKIE_DOMAIN=.xdtech.store`, `FRONTEND_ORIGIN`), configuración de UptimeRobot, revisión del pipeline de despliegue (ya activo desde el Sprint 0), evaluación de la nube naranja para el frontend, verificación de CORS con credenciales y de la cookie entre subdominios (ya probada en el Sprint 0), prueba de humo en producción (registro, compra de extremo a extremo, asistente).

## Cierre del proyecto
- Ensayo de la demo: flujo del cliente completo, flujo del asistente de IA, escenario de concurrencia y panel administrativo. Avisar a los evaluadores del arranque en frío.
- Documentación: arquitectura final (cinco piezas, sin cola de mensajes ni balanceador en la nube), diagramas actualizados, manual breve e informe de pruebas con los resultados de k6. El informe debe incluir la sección de alcance diferido (recuperación de acceso, RF-03) con su justificación, tomada de la sección 10 de `00_parte_tecnica.md`.

## Definición de hecho del sprint
Sistema accesible en línea, demo ensayada y documentación entregada.
