'use client';

import { useState } from 'react';

// TEMPORAL (Sprint 0, HU-36b): se elimina junto con el módulo diagnostico de la API.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Resultado = { paso: string; respuesta: unknown };

async function llamar(ruta: string): Promise<unknown> {
  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      credentials: 'include',
    });
    return { status: respuesta.status, cuerpo: await respuesta.json() };
  } catch (error) {
    return { error: String(error) };
  }
}

export function PanelDiagnostico() {
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const agregar = (paso: string, respuesta: unknown) =>
    setResultados((previos) => [...previos, { paso, respuesta }]);

  const probarCookie = async () => {
    agregar('1. Emitir cookie', await llamar('/diagnostico/cookie'));
    agregar('2. Reenviar cookie', await llamar('/diagnostico/cookie'));
  };

  const probarIp = async () => {
    agregar('IP detectada por la API', await llamar('/diagnostico/ip'));
  };

  return (
    <section>
      <p>
        API: <code>{API_URL}</code>
      </p>
      <p>
        La cookie funciona si el paso 2 responde <code>recibida: true</code>.
        Para repetir la prueba, borrar la cookie <code>diagnostico</code> del
        dominio de la API.
      </p>
      <button onClick={probarCookie}>Probar cookie entre subdominios</button>{' '}
      <button onClick={probarIp}>Ver IP detectada</button>
      <pre>{JSON.stringify(resultados, null, 2)}</pre>
    </section>
  );
}
