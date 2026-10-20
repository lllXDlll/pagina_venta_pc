# Sprint 3: Concurrencia y carrito (semana 4)

> Contexto previo: `00_parte_tecnica.md` (sección 5, reglas de concurrencia, es obligatoria). Implementa solo lo de este documento.

**Objetivo:** reservas atómicas sin sobreventa, expiración, reconciliación e idempotencia. **Es el sprint más importante del proyecto.**
**Depende de:** Sprint 2 (motor de reglas, configuraciones guardadas) y Sprint 1 (catálogo, stock con versión).

## HU-16 Agregar al carrito
**Como** cliente, **quiero** agregar al carrito una configuración o productos sueltos, **para** comprarlos juntos.

**Criterios de aceptación**
- Se puede agregar una configuración validada completa o productos individuales.
- Una configuración incompatible no se agrega (se revalida al agregar).
- Puedo quitar elementos o cambiar cantidades.
- El carrito muestra el total actualizado.

**Tareas:** módulo `carrito/`, `GET/POST/PATCH/DELETE /carrito`, revalidación con el motor, pantalla de carrito.

## HU-17 Reserva temporal atómica de stock
**Como** cliente, **quiero** que se reserve el stock al iniciar el pago, **para** completar la compra sin que me lo quiten.

**Criterios de aceptación**
- Un único script Lua verifica todos los productos y descuenta todos o ninguno.
- Si falta alguno, no se descuenta nada y se informa cuál faltó.
- La reserva tiene TTL (10 min, configurable) y se registra en Postgres con estado ACTIVA.
- Se muestra el tiempo restante al cliente.

**Tareas:** `reservas/` con `reservar.lua`, estructuras en Redis (`disp:{productoId}`, `reserva:{id}` con TTL, `reservas:vencimientos`), `POST /reservas`, registro en `reservas` y `reserva_items`, cliente Redis (ioredis) con carga de scripts.

## HU-18 Liberación automática de reservas expiradas
**Como** cliente, **quiero** que el stock no pagado se libere solo, **para** que otros puedan comprarlo.

**Criterios de aceptación**
- Reserva vencida: las cantidades vuelven al disponible y la reserva pasa a EXPIRADA en Postgres.
- La expiración corre cada minuto (tarea programada) **y antes de cada intento de reserva**.
- Pagar con una reserva expirada informa al usuario y permite reintentar la reserva.

**Tareas:** `expirar.lua`, tarea programada (`@nestjs/schedule`), llamada previa dentro de `reservar`, sincronización del estado en Postgres.

## HU-19 Sin sobreventa bajo alta demanda
**Como** administrador, **quiero** que un componente limitado nunca se venda más veces que sus unidades, **para** no vender lo que no existe.

**Criterios de aceptación**
- Con 300 intentos simultáneos sobre 5 unidades, exactamente 5 reservas son exitosas.
- Las órdenes confirmadas nunca superan el stock; el stock físico nunca es negativo.
- La confirmación usa actualización condicional con verificación de versión.

**Tareas:** servicio `confirmar` como transacción Postgres (`UPDATE stock SET cantidad = cantidad - n, version = version + 1 WHERE producto_id = X AND cantidad >= n AND version = v`), cierre de la reserva en Redis sin devolver stock, pruebas de integración concurrentes.
*Nota:* el endpoint de pago que invoca `confirmar` se construye en el Sprint 4; aquí se expone el servicio y se prueba directamente.

## HU-20 Confirmación idempotente
**Como** cliente, **quiero** que un reintento de red no duplique mi compra, **para** no pagar dos veces.

**Criterios de aceptación**
- La confirmación exige `Idempotency-Key`.
- Un reintento con la misma clave devuelve la orden original.
- Restricción de unicidad en `ordenes.clave_idempotencia`.

**Tareas:** validación del encabezado, manejo del error de unicidad devolviendo la orden existente, pruebas.

## HU-35 Reconciliación entre Redis y Postgres
**Como** desarrollador, **quiero** recalcular el disponible desde Postgres, **para** recuperarme de pérdidas de datos en Redis.

**Criterios de aceptación**
- Job periódico: disponible = stock físico − reservas ACTIVAS; corrige Redis si difiere.
- Al arrancar la API con Redis vacío, se reconstruye con el mismo cálculo.
- Tras reiniciar Redis, el disponible vuelve a ser correcto.

**Tareas:** `ReconciliacionService`, hook `onModuleInit`, tarea programada, implementar `DisponibleService` (punto de extensión del Sprint 1) leyendo de Redis y conectarlo al catálogo.

## HU-37a Primera prueba de carga k6 (local)
**Como** desarrollador, **quiero** un escenario k6 base, **para** demostrar la consistencia temprano.

**Criterios de aceptación**
- 300 usuarios virtuales intentan reservar el mismo componente de 5 unidades.
- Verificaciones: reservas exitosas == 5; ninguna orden por encima del stock; stock físico ≥ 0.

**Tareas:** `tests/k6/reserva_concurrente.js`, script de preparación del escenario, ejecución contra Docker local (no contra Upstash, para cuidar la cuota de comandos).

## Definición de hecho del sprint
Reservas atómicas funcionando, expiración y reconciliación operativas, prueba k6 local pasa sin sobreventa.
