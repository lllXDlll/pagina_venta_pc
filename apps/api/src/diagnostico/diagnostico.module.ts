import { Module } from '@nestjs/common';
import { DiagnosticoController } from './diagnostico.controller.js';

/** TEMPORAL (Sprint 0, HU-36b): solo se registra con DIAGNOSTICO_HABILITADO=true. */
@Module({
  controllers: [DiagnosticoController],
})
export class DiagnosticoModule {}
