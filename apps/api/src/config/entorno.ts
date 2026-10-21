/** Configuración de la API leída de variables de entorno (ver `.env.example`). */
export interface Entorno {
  port: number;
  databaseUrl: string;
  directUrl: string;
  redisUrl: string;
  /** Vacío en local: la cookie se emite sin `Domain`. */
  cookieDomain: string;
  frontendOrigin: string;
  sessionTtlDays: number;
  trustProxyHops: number;
  diagnosticoHabilitado: boolean;
}

export const ENTORNO = Symbol('ENTORNO');

type Variables = Record<string, string | undefined>;

/**
 * Valida las variables de entorno y devuelve la configuración tipada.
 * Lanza un error que nombra cada variable ausente o inválida, sin mostrar sus valores.
 */
export function validarEntorno(env: Variables): Entorno {
  const errores: string[] = [];

  const requerida = (nombre: string): string => {
    const valor = env[nombre]?.trim();
    if (!valor) {
      errores.push(`${nombre} es obligatoria`);
      return '';
    }
    return valor;
  };

  const entero = (nombre: string, porDefecto?: number): number => {
    const crudo = env[nombre]?.trim();
    if (!crudo) {
      if (porDefecto === undefined) errores.push(`${nombre} es obligatoria`);
      return porDefecto ?? 0;
    }
    const valor = Number(crudo);
    if (!Number.isInteger(valor) || valor < 0) {
      errores.push(`${nombre} debe ser un entero no negativo`);
    }
    return valor;
  };

  const entorno: Entorno = {
    port: entero('PORT', 3001),
    databaseUrl: requerida('DATABASE_URL'),
    directUrl: requerida('DIRECT_URL'),
    redisUrl: requerida('REDIS_URL'),
    cookieDomain: env.COOKIE_DOMAIN?.trim() ?? '',
    frontendOrigin: requerida('FRONTEND_ORIGIN'),
    sessionTtlDays: entero('SESSION_TTL_DAYS'),
    trustProxyHops: entero('TRUST_PROXY_HOPS', 1),
    diagnosticoHabilitado: env.DIAGNOSTICO_HABILITADO?.trim() === 'true',
  };

  if (errores.length > 0) {
    throw new Error(
      `Configuración inválida (revisar .env.example):\n- ${errores.join('\n- ')}`,
    );
  }
  return entorno;
}
