import { connectTimeoutMs } from './prisma.service.js';

describe('connectTimeoutMs', () => {
  it('usa 30 s si la cadena no define connect_timeout', () => {
    expect(connectTimeoutMs('postgresql://u:p@localhost:5432/db')).toBe(30_000);
  });

  it('respeta connect_timeout de la cadena', () => {
    expect(
      connectTimeoutMs(
        'postgresql://u:p@host/db?sslmode=require&connect_timeout=45',
      ),
    ).toBe(45_000);
  });

  it('ignora valores inválidos', () => {
    expect(
      connectTimeoutMs('postgresql://u:p@host/db?connect_timeout=abc'),
    ).toBe(30_000);
  });
});
