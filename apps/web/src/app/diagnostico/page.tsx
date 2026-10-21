import type { Metadata } from 'next';
import { PanelDiagnostico } from './panel-diagnostico';

// TEMPORAL (Sprint 0, HU-36b): se elimina junto con el módulo diagnostico de la API.
export const metadata: Metadata = {
  title: 'Diagnóstico',
  robots: { index: false },
};

export default function Diagnostico() {
  return (
    <main>
      <h1>Diagnóstico de plataforma</h1>
      <PanelDiagnostico />
    </main>
  );
}
