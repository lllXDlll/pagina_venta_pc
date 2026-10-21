# Spec Delta

## Purpose

Permite saber, sin autenticación, si el proceso de la API está vivo (sin tocar dependencias) y, por separado, si sus dependencias críticas (Postgres y Redis) responden, para que un monitor externo pueda vigilar la API sin consumir recursos de Neon ni de Upstash.

## ADDED Requirements

### Requirement: Endpoint de vida sin dependencias
(HU-36a) La API MUST exponer `GET /health/live`, sin autenticación, que responda 200 mientras el proceso esté en ejecución, sin consultar Postgres ni Redis.

#### Scenario: Proceso en ejecución
- **WHEN** se llama a `GET /health/live`
- **THEN** la API responde 200

#### Scenario: Dependencias caídas
- **WHEN** Postgres y Redis no están disponibles y se llama a `GET /health/live`
- **THEN** la API responde 200 igualmente

#### Scenario: Sin consumo de dependencias
- **WHEN** se llama a `GET /health/live`
- **THEN** no se ejecuta ninguna consulta a Postgres ni ningún comando a Redis

### Requirement: Endpoint de disponibilidad con verificación de dependencias
(HU-36a) La API MUST exponer `GET /health/ready`, sin autenticación, que verifique la conectividad con Postgres y con Redis e informe el estado de cada una en el cuerpo de la respuesta.

#### Scenario: Ambas dependencias disponibles
- **WHEN** se llama a `GET /health/ready` y Postgres y Redis responden
- **THEN** la API responde 200 con un cuerpo que indica estado correcto para Postgres y Redis

#### Scenario: Una dependencia no disponible
- **WHEN** se llama a `GET /health/ready` y Postgres o Redis no responde dentro del tiempo límite de la verificación
- **THEN** la API responde 503 indicando qué dependencia falló, sin exponer cadenas de conexión ni secretos

### Requirement: Salud verificable en local y en producción
(HU-36a) Ambos endpoints de salud MUST estar disponibles en el entorno local (Docker) y en producción bajo `https://api.xdtech.store`.

#### Scenario: Salud en entorno local
- **WHEN** la API corre localmente contra el Postgres y el Redis de `docker-compose`
- **THEN** `GET /health/live` y `GET /health/ready` responden 200

#### Scenario: Salud en producción
- **WHEN** la API está desplegada en Render conectada a Neon y Upstash
- **THEN** `https://api.xdtech.store/health/live` y `https://api.xdtech.store/health/ready` responden 200 por HTTPS con certificado válido
