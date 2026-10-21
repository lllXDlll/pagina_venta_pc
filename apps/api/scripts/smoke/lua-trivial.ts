// Prueba de humo (Sprint 0, HU-36b): ¿el Redis destino ejecuta scripts Lua?
// Uso: pnpm --filter api smoke:lua   (REDIS_URL de Upstash para la prueba real)
import { conectar } from './conectar.js';

const CLAVE = 'smoke:lua';
const SCRIPT = `
  local n = redis.call('INCR', KEYS[1])
  redis.call('EXPIRE', KEYS[1], 60)
  return { ARGV[1], n }
`;

const redis = conectar();
try {
  const resultado = (await redis.eval(SCRIPT, 1, CLAVE, 'hola')) as [
    string,
    number,
  ];
  const ok =
    resultado[0] === 'hola' &&
    Number.isInteger(resultado[1]) &&
    resultado[1] >= 1;
  console.log(`Resultado: ${JSON.stringify(resultado)}`);
  console.log(ok ? 'Lua: OK' : 'Lua: NO OK (resultado inesperado)');
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  console.error(`Lua: NO OK (${(error as Error).message})`);
  process.exitCode = 1;
} finally {
  await redis.del(CLAVE);
  redis.disconnect();
}
