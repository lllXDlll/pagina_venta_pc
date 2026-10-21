# Spec Delta

## Purpose

Define el esquema relacional del sistema como migraciones versionadas que se aplican de forma idéntica y reproducible en Postgres local y en Neon.

## ADDED Requirements

### Requirement: Migración inicial con el esquema completo
(HU-36a) El repositorio MUST contener una migración inicial que cree todas las tablas del modelo de datos del proyecto: usuarios, sesiones, categorias, productos, stock, reglas_compatibilidad, configuraciones, configuracion_items, carritos, carrito_items, reservas, reserva_items, ordenes, orden_items, comprobantes, notificaciones y uso_asistente.

#### Scenario: Esquema completo tras migrar
- **WHEN** se aplica la migración inicial sobre una base de datos vacía
- **THEN** existen todas las tablas listadas, con sus claves primarias y foráneas

#### Scenario: Tablas diferidas no se crean
- **WHEN** se aplica la migración inicial
- **THEN** no existe la tabla `tokens_recuperacion` (HU-03 diferida)

### Requirement: Restricciones que soportan las reglas de negocio
(HU-36a) El esquema MUST incluir desde la migración inicial las restricciones de las que dependen sprints posteriores: correo de usuario único, `ordenes.clave_idempotencia` única, hash de token de sesión único, columna `version` en `stock` y enumeraciones de rol, tipo de producto, origen de configuración y estado de reserva.

#### Scenario: Clave de idempotencia duplicada
- **WHEN** se intenta insertar dos órdenes con la misma clave de idempotencia
- **THEN** la base de datos rechaza la segunda inserción por violación de unicidad

#### Scenario: Correo duplicado
- **WHEN** se intenta insertar dos usuarios con el mismo correo
- **THEN** la base de datos rechaza la segunda inserción

#### Scenario: Atributos técnicos en JSONB
- **WHEN** se inspecciona la tabla `productos`
- **THEN** los atributos técnicos se almacenan en una columna JSONB

### Requirement: Migración aplicable en local y en Neon
(HU-36a) La misma migración MUST aplicarse sin cambios en Postgres local y en Neon, usando la conexión directa (no el pooler) para migrar.

#### Scenario: Migración en Postgres local
- **WHEN** se ejecuta el comando de migración contra el Postgres de `docker-compose`
- **THEN** la migración se aplica sin errores y el historial de migraciones queda registrado

#### Scenario: Migración en Neon
- **WHEN** se ejecuta el comando de migración contra Neon con la cadena de conexión directa
- **THEN** la migración se aplica sin errores y el esquema resultante es idéntico al local

### Requirement: Migraciones aplicadas al arrancar la API
(HU-36a) Cuando `MIGRAR_AL_ARRANCAR` vale `true`, la API MUST aplicar las migraciones pendientes, usando la conexión directa, antes de empezar a atender peticiones. Si la migración falla, la API MUST NOT arrancar. Cuando la variable no vale `true`, la API MUST arrancar sin migrar.

#### Scenario: Migraciones pendientes al desplegar
- **WHEN** se despliega una versión con una migración nueva y `MIGRAR_AL_ARRANCAR=true`
- **THEN** la migración queda aplicada en Neon antes de que la nueva versión responda a `GET /health/live`

#### Scenario: Sin migraciones pendientes
- **WHEN** la API arranca con `MIGRAR_AL_ARRANCAR=true` y el esquema ya está al día
- **THEN** arranca con normalidad sin modificar el esquema

#### Scenario: Migración fallida
- **WHEN** la API arranca con `MIGRAR_AL_ARRANCAR=true` y una migración falla
- **THEN** el proceso termina con error sin atender peticiones, y la versión desplegada anteriormente sigue atendiendo el tráfico

#### Scenario: Variable desactivada
- **WHEN** la API arranca sin `MIGRAR_AL_ARRANCAR` o con un valor distinto de `true`
- **THEN** no ejecuta migraciones

### Requirement: Migraciones compatibles hacia atrás
(HU-36a) Toda migración MUST ser compatible con el código de la versión desplegada anterior, porque durante un despliegue la versión vieja sigue atendiendo peticiones sobre el esquema nuevo. Renombrar o eliminar columnas o tablas en uso MUST hacerse en dos despliegues (*expand/contract*).

#### Scenario: Agregar una columna
- **WHEN** una migración agrega una columna nueva a una tabla existente
- **THEN** la columna es opcional o tiene un valor por defecto, de modo que el código anterior puede seguir insertando filas

#### Scenario: Eliminar una columna en uso
- **WHEN** se quiere eliminar una columna que el código desplegado todavía usa
- **THEN** primero se despliega una versión que deja de usarla y solo en un despliegue posterior se elimina
