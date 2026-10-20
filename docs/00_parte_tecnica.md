# Parte técnica: especificaciones y reglas de construcción

> Léelo completo antes de cualquier sprint. Es el contexto fijo del proyecto. Las historias de usuario están en `sprint_0X.md`; cada sprint se implementa en orden y solo se lee el del sprint actual.

## 1. Descripción del proyecto

Plataforma web de venta de computadoras y componentes. El cliente arma su PC manualmente o con un asistente de IA que recomienda según presupuesto y uso. Toda configuración se valida con un motor de reglas de compatibilidad. El punto crítico es la **concurrencia**: 300 usuarios simultáneos compitiendo por un componente de stock limitado sin sobreventa.

Fuera de alcance: pasarelas de pago reales, logística de envío, garantías y servicio técnico, marketplace multivendedor, comparación con otras tiendas, diagnóstico de hardware con IA, chatbot de soporte general, reconocimiento de imágenes. Diferido a una mejora futura: la recuperación de contraseña por correo (ver sección 10).

## 2. Stack y despliegue (5 piezas, planes gratuitos)

| Pieza | Tecnología / servicio | Responsabilidad |
|---|---|---|
| Frontend | Next.js en Vercel | Catálogo, armador, carrito, historial, panel admin |
| Backend | NestJS (TypeScript) en Render | Lógica de negocio, motor de reglas, reservas, pago simulado, tareas programadas |
| Base de datos | PostgreSQL en Neon + Prisma | Fuente de verdad: catálogo, stock, reservas, órdenes |
| Caché / concurrencia | Redis en Upstash | Disponible para vender, reservas con TTL, script Lua atómico |
| IA | API de un LLM (Claude) tras un adaptador intercambiable | Recomendación explicada de configuraciones |

Notas operativas:
- Docker solo para desarrollo local y pruebas de carga. No hay cola de mensajes ni balanceador en la nube.
- Neon requiere dos cadenas de conexión: pooler para la app y directa para migraciones.
- Render gratuito se apaga tras ~15 min sin tráfico (~1 min en despertar): exponer `GET /health` para un monitor externo. Solo la API se despliega en Render.
- Upstash gratuito limita comandos mensuales: las pruebas repetidas de concurrencia se hacen contra Redis local.
- El proyecto no envía correos: las notificaciones son dentro de la aplicación. No hay proveedor de correo ni configuración SPF/DKIM.
- Costo: todo el stack usa planes gratuitos **excepto el dominio `xdtech.store`**, que tiene costo de compra y de renovación anual. Debe estar comprado y con su DNS administrado en Cloudflare **antes de empezar el Sprint 0**, porque HU-36a depende de él.

### 2.1 Dominio, sesión y límites de peticiones (decisiones fijadas)

**Dominio y DNS.** Dominio propio `xdtech.store` con DNS en Cloudflare (CDN delante del frontend).
- Frontend (Vercel): `xdtech.store` o `app.xdtech.store`.
- API (Render): `api.xdtech.store`, registro DNS en modo solo DNS (nube gris), porque Render gestiona su propio certificado.
- Frontend en Cloudflare: si se usa nube naranja, modo SSL "Full (strict)" y sin caché para `/api/*` ni para respuestas con `Set-Cookie`. Verificar la recomendación vigente de Vercel antes del despliegue final; la alternativa segura es DNS en nube gris.
- Ambos subdominios son del mismo sitio para el navegador, por lo que no se usa proxy desde Next.js ni cookies de terceros.

**Sesión.** Cookie de sesión con identificador opaco; la sesión se guarda en Postgres (tabla `sesiones`).
- Cookie: `httpOnly; Secure; SameSite=Lax; Domain=.xdtech.store` (en desarrollo local, sin `Domain` ni `Secure`).
- El valor de la cookie es un token aleatorio; en la base de datos solo se guarda su hash.
- Vencimiento: 7 días (variable de entorno). Cerrar sesión marca la sesión como revocada.
- Limpieza: una tarea programada diaria (`@nestjs/schedule`) borra las sesiones vencidas y las revocadas con más de un día; además, al iniciar sesión se borran las sesiones vencidas o revocadas de ese usuario (necesario porque Render gratuito se duerme y la tarea solo corre si la instancia está despierta). Una sesión vencida o revocada siempre se rechaza, se haya borrado o no.
- CORS: la API permite credenciales únicamente desde el origen del frontend (variable de entorno), nunca con comodín.
- Se descarta JWT: no permite invalidar la sesión al cerrar sesión sin una lista de bloqueo adicional.

**Límites de peticiones (rate limiting).**
- **Registro:** límite por IP. Limitar por correo no protege, porque quien abusa cambia de correo en cada intento.
- **Inicio de sesión:** límite por correo (frena fuerza bruta contra una cuenta) y, además, un límite por IP más holgado.
- **Asistente de IA:** límite por usuario autenticado, contado a partir de las filas de `uso_asistente` de las últimas 24 horas (dato durable en Postgres, sin almacenamiento adicional).
- **IP real del cliente:** el navegador llama directo a `api.xdtech.store` (nube gris), así que el único proxy en la cadena es el de Render. Configurar `trust proxy` en NestJS/Express para leer la IP real desde `X-Forwarded-For`, y verificarlo en el Sprint 0. Si la API pasara a nube naranja o detrás de otro proxy, habría que leer `CF-Connecting-IP`.
- **Dónde viven los contadores:** en memoria del proceso (almacenamiento por defecto de `@nestjs/throttler`). **No usar Redis** para esto: cada petición limitada gastaría comandos de la cuota mensual de Upstash, que se reserva para stock y reservas. Es válido porque hay una sola instancia de la API; los contadores se reinician si Render reinicia el servicio, y eso es aceptable. Si algún día hubiera varias instancias, habría que mover los contadores a un almacén compartido.
- Los valores concretos son configurables por variables de entorno (ver sección 7).

## 3. Estructura del repositorio

```
repo/
  apps/
    web/                 Next.js (frontend)
    api/                 NestJS (backend)
      src/
        auth/            registro, sesión, roles
        catalogo/        productos, atributos técnicos, stock
        compatibilidad/  motor de reglas
        asistente/       adaptador de IA y respaldo determinístico
        carrito/
        reservas/        scripts Lua y reconciliación
        pagos/           pago simulado y comprobantes
        notificaciones/
        historial/
        admin/           gestión y reportes
        health/          endpoints de salud
      prisma/            esquema y migraciones
  tests/
    k6/                  escenarios de carga
  docker-compose.yml     Postgres y Redis locales
  .github/workflows/     integración continua
```

## 4. Modelo de datos (Prisma)

| Tabla | Contenido principal |
|---|---|
| usuarios | correo, hash de contraseña, rol (CLIENTE / ADMIN), estado |
| sesiones | hash del token de sesión, usuario, vencimiento, revocada, fecha de creación |
| categorias | procesador, placa madre, RAM, tarjeta gráfica, fuente, gabinete, almacenamiento, equipo armado |
| productos | nombre, tipo (COMPONENTE / EQUIPO), precio, activo, atributos técnicos en JSONB |
| stock | producto, cantidad física, versión (bloqueo optimista) |
| reglas_compatibilidad | código de regla (`SOCKET`, `RAM`, `POTENCIA`, `DIMENSIONES`, `FACTOR_FORMA`, `ALMACENAMIENTO`), parámetros JSONB, activa |
| configuraciones | usuario, origen (MANUAL / IA), presupuesto, uso, estado |
| configuracion_items | configuración, producto, cantidad |
| carritos / carrito_items | carrito del usuario con productos o configuraciones |
| reservas / reserva_items | usuario, estado (ACTIVA / CONFIRMADA / EXPIRADA), vencimiento, productos y cantidades |
| ordenes / orden_items | compra confirmada, clave de idempotencia única, total |
| comprobantes | número, orden, fecha, detalle |
| notificaciones | usuario, tipo, mensaje, leída |
| uso_asistente | usuario, presupuesto, uso, resultado, latencia, si se usó respaldo |

Atributos técnicos esperados en JSONB: `socket`, `tipoRam`, `velocidadRam`, `maxModulosRam`, `potenciaConsumidaW`, `potenciaEntregadaW`, `dimensiones` (largo GPU, alto disipador, medidas del gabinete), `factorForma`, `interfacesAlmacenamiento`.

Un equipo armado se registra como producto propio con su propio stock.

## 5. Reglas de concurrencia (no negociables)

1. **Postgres guarda la verdad**: stock físico y compras confirmadas.
2. **Redis guarda el disponible para vender** = stock físico − reservas activas.
3. Ninguna venta se confirma sin una transacción en Postgres.
4. **Reservar**: un único script Lua verifica que todos los productos tengan disponible suficiente; si es así, descuenta todos, crea la reserva con TTL y la añade al índice de vencimientos. Si falta alguno, no descuenta nada y devuelve cuál faltó.
5. **Registrar**: la API guarda la reserva en Postgres con estado ACTIVA (respaldo auditable).
6. **Confirmar**: con `Idempotency-Key`, una transacción Postgres descuenta el stock físico con actualización condicional (`cantidad >= n AND version = v`), crea la orden y el comprobante y marca la reserva CONFIRMADA. Después cierra la reserva en Redis **sin devolver stock**.
7. **Expirar**: un script Lua revisa el índice de vencimientos, devuelve al contador las cantidades de las reservas vencidas y las elimina. Se ejecuta cada minuto **y antes de cada intento de reserva**. La reserva en Postgres pasa a EXPIRADA.
8. **Reconciliar**: job periódico recalcula el disponible como stock físico − reservas ACTIVAS y corrige Redis; al arrancar la API, si Redis está vacío, se reconstruye con el mismo cálculo.
9. **Idempotencia**: cada confirmación exige el encabezado `Idempotency-Key`; una restricción de unicidad en `ordenes` hace que un reintento devuelva la orden original.
10. La IA **nunca** participa en concurrencia ni en cobro.

Estructuras en Redis: contador de disponible por producto (`disp:{productoId}`), registro por reserva con TTL (`reserva:{id}`), índice ordenado por vencimiento (`reservas:vencimientos`).

## 6. Reglas de construcción

- TypeScript estricto. Validación de entradas con DTOs (class-validator).
- Errores de negocio devuelven `{ codigo, mensaje }` con mensaje comprensible para el usuario.
- Guardas por rol en todo endpoint administrativo.
- Secretos solo en variables de entorno; mantener `.env.example` actualizado. Nunca versionar secretos.
- Contraseñas con argon2 o bcrypt; sesiones por cookie `httpOnly` guardadas en Postgres, con vencimiento (sección 2.1).
- Límite de peticiones: registro (por IP), inicio de sesión (por correo y por IP) y asistente de IA (por usuario). Los contadores de registro e inicio de sesión viven en memoria, nunca en Redis; el límite del asistente se cuenta desde `uso_asistente` en Postgres (sección 2.1).
- Pruebas unitarias junto a cada módulo; pruebas de integración contra Postgres y Redis reales en Docker.
- No introducir tecnologías fuera del stack (sin colas de mensajes, sin balanceador, sin otra base de datos).
- Cada sprint termina con: código en la rama principal, CI en verde y las pruebas del sprint pasando.

## 7. Valores por defecto (configurables)

| Parámetro | Valor | Dónde se configura |
|---|---|---|
| TTL de reservas | 10 min | Variable de entorno (usar valor corto en pruebas) |
| Margen de potencia de la fuente | 20 % | Parámetro en `reglas_compatibilidad` |
| Escenario de carga | 300 usuarios virtuales, componente con 5 unidades | Script k6 |
| Timeout de la API de IA | Configurable | Variable de entorno |
| Duración de la sesión | 7 días | Variable de entorno |
| Límite de registro | 5 registros por hora por IP | Variable de entorno |
| Límite de inicio de sesión | 5 intentos fallidos por 15 min por correo; 50 por 15 min por IP | Variable de entorno |
| Límite del asistente | 10 consultas por 24 h por usuario | Variable de entorno |

## 8. Cómo trabajar con los sprints

1. Lee este documento y luego solo el `sprint_0X.md` actual.
2. Implementa únicamente las historias de ese sprint; no adelantes funcionalidades de sprints posteriores.
3. Cuando una historia dependa de algo de un sprint anterior, asume que ya existe y úsalo.
4. Al terminar, verifica la definición de hecho del sprint antes de pasar al siguiente.

| Sprint | Archivo | Foco |
|---|---|---|
| 0 | `sprint_00_fundamentos.md` | Base técnica y riesgos |
| 1 | `sprint_01_usuarios_catalogo.md` | Usuarios y catálogo |
| 2 | `sprint_02_motor_reglas.md` | Motor de reglas y armador manual |
| 3 | `sprint_03_concurrencia_carrito.md` | Concurrencia y carrito |
| 4 | `sprint_04_pago_historial.md` | Pago, notificaciones e historial |
| 5 | `sprint_05_asistente_ia.md` | Asistente de IA |
| 6 | `sprint_06_administracion.md` | Administración y endurecimiento |
| 7 | `sprint_07_despliegue.md` | Despliegue final y cierre |

## 9. Criterios de aceptación globales

- Todos los requerimientos funcionales cubiertos y probados.
- Ninguna configuración incompatible llega al carrito, ni siquiera la generada por IA.
- El escenario de 300 usuarios concurrentes sobre un componente limitado termina sin sobreventa y con stock consistente entre Redis y Postgres.
- La liberación de reservas expiradas funciona sin intervención manual.
- Sistema desplegado en línea por HTTPS.

Plan de recorte si el tiempo se acorta: mantener siempre concurrencia (Sprint 3) y compra de extremo a extremo (Sprint 4); recortar en este orden HU-34, HU-33, HU-15, HU-32, HU-26.

## 10. Alcance diferido y justificación

### Recuperación de acceso por correo (HU-03, diferida)
- **Requerimiento afectado:** RF-03 de la propuesta original, "recuperación de acceso mediante los mecanismos definidos para la aplicación".
- **Decisión:** se difiere a una mejora futura y no se implementa en las 8 semanas.
- **Justificación (para el informe):** exige un proveedor de correo externo, verificación del dominio emisor (SPF y DKIM) y un canal adicional que cuidar en un despliegue de planes gratuitos con un solo desarrollador. No participa en el objetivo central de la asignatura (consistencia del stock bajo concurrencia) ni en el flujo de compra. Además, el plan gratuito de Render podría bloquear los puertos SMTP salientes (a verificar), lo que obligaría a usar un proveedor por API HTTP.
- **Mitigación actual:** el registro y el inicio de sesión funcionan con normalidad; el usuario que olvide su contraseña debe registrar una cuenta nueva.
- **Mejora futura sugerida:** recuperación por enlace de un solo uso enviado por correo, con un proveedor de API HTTP (por ejemplo Resend), dominio `xdtech.store` verificado, tabla `tokens_recuperacion` (token de un solo uso con vencimiento) y límite de peticiones por correo. Alternativa sin correo: restablecimiento de contraseña por un administrador desde el panel, con contraseña temporal.
- **Efecto en los documentos:** se elimina HU-03 y la tabla `tokens_recuperacion`; no existen los endpoints `/auth/recuperar` ni `/auth/restablecer`.

### Criterio de trazabilidad
Al cerrar el proyecto, RF-03 se reporta como "diferido con justificación", no como cumplido.
