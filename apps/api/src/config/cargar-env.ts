import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * En desarrollo carga el `.env` de la raíz del repositorio si existe.
 * En producción no hay archivo: Render define las variables directamente.
 * Las variables ya definidas en el proceso no se sobrescriben.
 */
export function cargarEnvLocal(): void {
  // Misma profundidad desde src/config y dist/config: config -> src|dist -> api -> apps -> raíz
  const ruta = resolve(import.meta.dirname, '../../../../.env');
  if (!existsSync(ruta)) return;
  // Se asigna a mano (y no con process.loadEnvFile) para que funcione también
  // en el entorno aislado de Jest, que usa su propia copia de process.env.
  for (const [nombre, valor] of Object.entries(
    parseEnv(readFileSync(ruta, 'utf8')),
  )) {
    process.env[nombre] ??= valor;
  }
}
