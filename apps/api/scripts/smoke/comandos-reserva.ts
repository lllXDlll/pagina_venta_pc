// Prueba de humo (Sprint 0, HU-36b): ¿cuántos comandos de Redis consume una reserva?
// Reserva de ejemplo de tres productos como un único EVAL (regla 4 de la sección 5).
// No es el script real del Sprint 3: solo reproduce su forma para medir el consumo.
// Uso: pnpm --filter api smoke:comandos   (REDIS_URL de Upstash para comparar con su consola)
import { randomUUID } from 'node:crypto';
import { conectar } from './conectar.js';

const CUOTA_MENSUAL_UPSTASH = 500_000;
const PRODUCTOS = ['smoke-a', 'smoke-b', 'smoke-c'];

// KEYS: disp:{producto}...  ARGV: [reservaId, venceEnEpoch, ttlSegundos, cantidad...]
const RESERVAR = `
  local n = #KEYS
  for i = 1, n do
    local disponible = tonumber(redis.call('GET', KEYS[i]) or '0')
    if disponible < tonumber(ARGV[3 + i]) then return { 0, KEYS[i] } end
  end
  for i = 1, n do redis.call('DECRBY', KEYS[i], ARGV[3 + i]) end
  redis.call('SET', 'reserva:' .. ARGV[1], cjson.encode(ARGV), 'EX', ARGV[3])
  redis.call('ZADD', 'reservas:vencimientos', ARGV[2], ARGV[1])
  return { 1, ARGV[1] }
`;

/** Suma de `calls` por comando según INFO commandstats (puede no estar disponible en Upstash). */
async function llamadasPorComando(redis: ReturnType<typeof conectar>) {
  const info = await redis.info('commandstats');
  const llamadas = new Map<string, number>();
  for (const linea of info.split('\n')) {
    const coincidencia = /^cmdstat_([^:]+):calls=(\d+)/.exec(linea.trim());
    if (coincidencia) llamadas.set(coincidencia[1], Number(coincidencia[2]));
  }
  return llamadas;
}

const redis = conectar();
const claves = PRODUCTOS.map((producto) => `disp:${producto}`);
const reservaId = `smoke-${randomUUID()}`;
try {
  await Promise.all(claves.map((clave) => redis.set(clave, 5)));

  let antes: Map<string, number> | undefined;
  try {
    antes = await llamadasPorComando(redis);
  } catch {
    console.log(
      'INFO commandstats no disponible: usar las métricas de la consola de Upstash.',
    );
  }

  const resultado = await redis.eval(
    RESERVAR,
    claves.length,
    ...claves,
    reservaId,
    Date.now() + 600_000,
    600,
    ...PRODUCTOS.map(() => 1),
  );
  console.log(`Resultado de la reserva: ${JSON.stringify(resultado)}`);
  console.log('Comandos enviados por la API: 1 (EVAL)');

  if (antes) {
    const despues = await llamadasPorComando(redis);
    // El INFO de "antes" también se cuenta en "después": se descarta
    const delta = [...despues]
      .map(
        ([comando, n]) =>
          [
            comando,
            n - (antes.get(comando) ?? 0) - (comando === 'info' ? 1 : 0),
          ] as const,
      )
      .filter(([, n]) => n > 0);
    const internos = delta
      .filter(([comando]) => comando !== 'eval')
      .reduce((s, [, n]) => s + n, 0);
    console.log(
      `Ejecutados en el servidor: ${JSON.stringify(Object.fromEntries(delta))}`,
    );
    console.log(`Comandos internos del script: ${internos}`);
    console.log(
      `Estimación: si se factura 1 comando por EVAL, ${CUOTA_MENSUAL_UPSTASH.toLocaleString('es-PE')} comandos/mes = ` +
        `${CUOTA_MENSUAL_UPSTASH.toLocaleString('es-PE')} reservas; si cuenta cada comando interno, ` +
        `${Math.floor(CUOTA_MENSUAL_UPSTASH / (internos + 1)).toLocaleString('es-PE')} reservas/mes.`,
    );
  }
} finally {
  await redis.del(...claves, `reserva:${reservaId}`);
  await redis.zrem('reservas:vencimientos', reservaId);
  redis.disconnect();
}
