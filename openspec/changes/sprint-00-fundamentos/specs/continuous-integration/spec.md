# Spec Delta

## Purpose

Garantiza que cada cambio publicado en el repositorio se verifica automáticamente (lint, pruebas unitarias, pruebas de integración contra Postgres y Redis reales, y build) antes de considerarse terminado.

## ADDED Requirements

### Requirement: CI en cada push
(HU-36a) El repositorio MUST ejecutar automáticamente un pipeline de integración continua en cada push a cualquier rama y en cada pull request hacia la rama principal.

#### Scenario: Push dispara la CI
- **WHEN** se hace push de un commit al repositorio remoto
- **THEN** se inicia una ejecución del pipeline asociada a ese commit

### Requirement: Etapas del pipeline
(HU-36a) El pipeline MUST instalar dependencias y ejecutar lint, pruebas unitarias, pruebas de integración y build de `apps/web` y `apps/api`, y MUST fallar si cualquiera de esas etapas falla.

#### Scenario: Todas las etapas pasan
- **WHEN** el código cumple el lint, sus pruebas pasan y ambas aplicaciones compilan
- **THEN** la ejecución termina en verde

#### Scenario: Una etapa falla
- **WHEN** falla el lint, una prueba o el build de cualquiera de las aplicaciones
- **THEN** la ejecución termina en rojo e indica la etapa que falló

### Requirement: Integración contra servicios reales
(HU-36a) Las pruebas de integración en CI MUST ejecutarse contra Postgres y Redis reales levantados como servicios del pipeline, con el esquema migrado, y nunca contra Neon ni Upstash.

#### Scenario: Disponibilidad verificada en CI
- **WHEN** la CI ejecuta las pruebas de integración
- **THEN** `GET /health/ready` responde 200 contra el Postgres y el Redis del pipeline

#### Scenario: Sin credenciales de producción en CI
- **WHEN** se inspecciona la configuración del pipeline
- **THEN** no contiene cadenas de conexión ni claves de Neon, Upstash ni de otros servicios de producción
