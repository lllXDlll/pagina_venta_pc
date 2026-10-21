import baseConfig from './jest.config.mjs';

/** Pruebas e2e y de integración: requieren el Postgres y el Redis de Docker. */
export default {
  ...baseConfig,
  testRegex: String.raw`test/.*\.e2e-spec\.ts$`,
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
