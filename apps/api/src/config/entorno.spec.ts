import { Test } from '@nestjs/testing';
import { validarEntorno } from './entorno.js';
import { EntornoModule } from './entorno.module.js';

const completo = {
  DATABASE_URL: 'postgresql://u:secreto@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:secreto@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  FRONTEND_ORIGIN: 'http://localhost:3000',
  SESSION_TTL_DAYS: '7',
};

describe('validarEntorno', () => {
  it('devuelve la configuración con valores por defecto', () => {
    const entorno = validarEntorno(completo);
    expect(entorno.port).toBe(3001);
    expect(entorno.trustProxyHops).toBe(1);
    expect(entorno.cookieDomain).toBe('');
    expect(entorno.diagnosticoHabilitado).toBe(false);
    expect(entorno.sessionTtlDays).toBe(7);
  });

  it('nombra cada variable ausente sin mostrar valores', () => {
    const {
      REDIS_URL: _redis,
      FRONTEND_ORIGIN: _origen,
      ...incompleto
    } = completo;
    expect(() => validarEntorno(incompleto)).toThrow(
      /REDIS_URL es obligatoria/,
    );
    expect(() => validarEntorno(incompleto)).toThrow(
      /FRONTEND_ORIGIN es obligatoria/,
    );
    expect(() => validarEntorno(incompleto)).not.toThrow(/secreto/);
  });

  it('rechaza enteros inválidos', () => {
    expect(() =>
      validarEntorno({ ...completo, SESSION_TTL_DAYS: 'siete' }),
    ).toThrow(/SESSION_TTL_DAYS debe ser un entero/);
  });
});

describe('EntornoModule', () => {
  const original = process.env;
  afterEach(() => {
    process.env = original;
  });

  it('aborta el arranque si falta una variable', async () => {
    const { DATABASE_URL: _db, ...incompleto } = completo;
    process.env = { ...incompleto };
    await expect(
      Test.createTestingModule({ imports: [EntornoModule] }).compile(),
    ).rejects.toThrow(/DATABASE_URL es obligatoria/);
  });
});
