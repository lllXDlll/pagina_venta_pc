import { Global, Module } from '@nestjs/common';
import { ENTORNO, validarEntorno } from './entorno.js';

/** Valida el entorno al construir la aplicación: si falta una variable, no arranca. */
@Global()
@Module({
  providers: [
    { provide: ENTORNO, useFactory: () => validarEntorno(process.env) },
  ],
  exports: [ENTORNO],
})
export class EntornoModule {}
