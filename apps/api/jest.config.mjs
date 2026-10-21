import { createDefaultEsmPreset } from 'ts-jest';

/** Pruebas unitarias: archivos *.spec.ts junto a cada módulo. */
export default {
  ...createDefaultEsmPreset(),
  testEnvironment: 'node',
  testRegex: String.raw`src/.*\.spec\.ts$`,
  // Los imports ESM usan la extensión .js; Jest resuelve el .ts correspondiente
  moduleNameMapper: { [String.raw`^(\.{1,2}/.*)\.js$`]: '$1' },
};
