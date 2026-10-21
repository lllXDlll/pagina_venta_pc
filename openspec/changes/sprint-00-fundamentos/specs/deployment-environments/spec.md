# Spec Delta

## Purpose

Define los entornos local y de producción del sistema bajo el dominio `xdtech.store`, su configuración por variables de entorno y los supuestos de plataforma (Lua, pooler, cookie entre subdominios, IP real) que deben estar validados y documentados.

## ADDED Requirements

### Requirement: Frontend y API accesibles por HTTPS
(HU-36a) El frontend MUST servirse desde Vercel en `app.xdtech.store` y la API desde Render en `api.xdtech.store`, ambos por HTTPS con certificado válido. El registro DNS de la API MUST ser solo DNS (sin proxy de Cloudflare).

#### Scenario: Frontend vacío en producción
- **WHEN** un navegador abre `https://app.xdtech.store`
- **THEN** la página inicial del frontend carga sin advertencias de certificado

#### Scenario: API en producción
- **WHEN** se llama a `https://api.xdtech.store/health/live`
- **THEN** la respuesta llega por HTTPS con certificado válido emitido para ese subdominio

### Requirement: Despliegue continuo desde la rama principal
(HU-36a) Cada push a `main` MUST desplegar automáticamente el frontend en Vercel y la API en Render. La API MUST desplegarse solo si la CI de ese commit terminó en verde.

#### Scenario: Push con CI en verde
- **WHEN** se hace push a `main` y la CI de ese commit pasa
- **THEN** Vercel y Render despliegan la nueva versión sin intervención manual

#### Scenario: Push con CI en rojo
- **WHEN** se hace push a `main` y la CI de ese commit falla
- **THEN** Render no despliega esa versión y la API sigue con la versión anterior

#### Scenario: Previews de Vercel
- **WHEN** Vercel publica una vista previa de una rama en un dominio fuera de `xdtech.store`
- **THEN** la vista previa muestra la interfaz, pero no se espera que la sesión funcione en ella, porque la cookie y CORS solo admiten `app.xdtech.store`

### Requirement: Configuración por variables de entorno
(HU-36a) Toda configuración y todo secreto MUST leerse de variables de entorno. El repositorio MUST incluir un `.env.example` con cada variable usada (incluidas `COOKIE_DOMAIN`, `FRONTEND_ORIGIN`, `SESSION_TTL_DAYS` y `MIGRAR_AL_ARRANCAR`) y MUST NOT versionar archivos `.env` con valores reales.

#### Scenario: Variables documentadas
- **WHEN** se compara el código con `.env.example`
- **THEN** cada variable de entorno leída por `apps/api` o `apps/web` figura en `.env.example` con un valor de ejemplo no secreto

#### Scenario: Secretos fuera del repositorio
- **WHEN** se inspecciona el historial del repositorio
- **THEN** no contiene archivos `.env` ni credenciales reales

### Requirement: Entorno local reproducible
(HU-36a) El repositorio MUST permitir levantar Postgres y Redis locales con un único comando de `docker compose`, suficientes para ejecutar la API, sus migraciones y sus pruebas de integración.

#### Scenario: Levantar dependencias locales
- **WHEN** un desarrollador ejecuta `docker compose up -d` en la raíz del repositorio
- **THEN** Postgres y Redis quedan disponibles en los puertos indicados en `.env.example`

### Requirement: Tolerancia al despertar de Neon
(HU-36a) La conexión de la API a Postgres MUST tolerar que el cómputo de Neon esté suspendido, con un tiempo de espera de conexión suficiente para que la primera petición tras un periodo de inactividad complete en lugar de fallar.

#### Scenario: Primera petición tras inactividad
- **WHEN** Neon lleva más de 5 minutos suspendido y llega una petición que consulta Postgres, como `GET /health/ready`
- **THEN** la petición completa con éxito, aunque tarde más que una petición con Neon activo

### Requirement: Validación de supuestos de plataforma
(HU-36b) Antes de cerrar el sprint MUST verificarse en los servicios reales: un script Lua en Upstash, Prisma a través del pooler de Neon, los comandos Redis que consume una reserva de ejemplo, el envío de la cookie entre `app.` y `api.`, y la lectura de la IP real del cliente en la API.

#### Scenario: Lua en Upstash
- **WHEN** se ejecuta un script Lua trivial en la instancia de Upstash
- **THEN** devuelve el resultado esperado o el fallo queda registrado

#### Scenario: Prisma con pooler
- **WHEN** la API desplegada lee y escribe en Neon usando la cadena del pooler
- **THEN** las operaciones completan sin errores de sentencias preparadas ni de conexión, o el fallo queda registrado

#### Scenario: Consumo de comandos Redis
- **WHEN** se ejecuta una operación de reserva de ejemplo contra Redis
- **THEN** se registra el número de comandos consumidos y su efecto estimado sobre los 500K comandos mensuales de Upstash

#### Scenario: Cookie entre subdominios
- **WHEN** un endpoint temporal de `api.xdtech.store` emite una cookie `httpOnly; Secure; SameSite=Lax; Domain=.xdtech.store` y luego el frontend en `app.xdtech.store` hace una petición con credenciales a la API
- **THEN** la API recibe la cookie en Chrome y en Safari o Firefox, y CORS solo acepta credenciales desde el origen del frontend

#### Scenario: IP real del cliente
- **WHEN** un cliente real llama a un endpoint temporal que devuelve la IP detectada por la API
- **THEN** la IP devuelta es la pública del cliente y no la de un proxy de Render

#### Scenario: Endpoints temporales eliminados
- **WHEN** termina la validación de supuestos
- **THEN** los endpoints temporales de cookie e IP ya no existen en el código ni en producción

### Requirement: Resultados documentados con alternativa ante fallos
(HU-36b) El resultado de cada validación MUST quedar documentado como OK o no OK en el `README.md`. Ante un resultado no OK MUST documentarse la alternativa decidida antes de iniciar el Sprint 1.

#### Scenario: Todo OK
- **WHEN** todas las validaciones pasan
- **THEN** el `README.md` registra OK para Lua en Upstash, Prisma con pooler, cookie entre subdominios (con los navegadores probados) e IP real, más el consumo medido de comandos Redis

#### Scenario: Cookie entre subdominios falla
- **WHEN** la cookie no se envía en algún navegador probado
- **THEN** el `README.md` documenta el fallo y la alternativa decidida antes del Sprint 1

#### Scenario: IP real no detectada
- **WHEN** la API ve la IP de un proxy en lugar de la del cliente
- **THEN** se ajusta el número de saltos de `trust proxy` o el encabezado leído, y el ajuste queda documentado antes del Sprint 1

#### Scenario: Lua no funciona en Upstash
- **WHEN** el script Lua falla en Upstash
- **THEN** el `README.md` documenta la alternativa (Redis local u otro ajuste del plan) antes de continuar
