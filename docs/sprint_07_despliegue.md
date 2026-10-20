# Sprint 7: Despliegue final y cierre (semana 8)

> Contexto previo: `00_parte_tecnica.md`. Implementa solo lo de este documento.

**Objetivo:** sistema en línea, demo ensayada y documentación final.
**Depende de:** Sprint 6 (sistema completo y probado).

## HU-36c Despliegue final
**Como** desarrollador, **quiero** el sistema desplegado en los servicios gratuitos, **para** presentarlo en línea.

**Criterios de aceptación**
- Frontend en Vercel (dominio `xdtech.store` o `app.xdtech.store`), API en Render (`api.xdtech.store`), base de datos en Neon y Redis en Upstash, todo accesible por HTTPS.
- DNS en Cloudflare según la sección 2.1 de `00_parte_tecnica.md`: `api.` en solo DNS; para el frontend, nube gris o, si se usa nube naranja, SSL "Full (strict)" y sin caché para `/api/*` ni para respuestas con `Set-Cookie`.
- Registro, inicio y cierre de sesión funcionan en producción entre `app.` y `api.` con la cookie `Domain=.xdtech.store`, en al menos dos navegadores.
- Despliegue disparado desde la rama principal; las migraciones se aplican al arrancar solo si una variable de entorno lo habilita.
- Un monitor externo (UptimeRobot) consulta `GET /health` para mitigar el arranque en frío de Render.
- Se confirman los límites vigentes de los planes gratuitos antes de la demo.
- Se mantiene la opción de ejecutar todo con Docker local como plan de respaldo.

**Tareas:** configurar variables de entorno en cada servicio (`COOKIE_DOMAIN=.xdtech.store`, `FRONTEND_ORIGIN`), pipeline de despliegue, verificación de CORS con credenciales y de la cookie entre subdominios (ya probada en el Sprint 0), prueba de humo en producción (registro, compra de extremo a extremo, asistente).

## Cierre del proyecto
- Ensayo de la demo: flujo del cliente completo, flujo del asistente de IA, escenario de concurrencia y panel administrativo. Avisar a los evaluadores del arranque en frío.
- Documentación: arquitectura final (cinco piezas, sin cola de mensajes ni balanceador en la nube), diagramas actualizados, manual breve e informe de pruebas con los resultados de k6. El informe debe incluir la sección de alcance diferido (recuperación de acceso, RF-03) con su justificación, tomada de la sección 10 de `00_parte_tecnica.md`.

## Definición de hecho del sprint
Sistema accesible en línea, demo ensayada y documentación entregada.
