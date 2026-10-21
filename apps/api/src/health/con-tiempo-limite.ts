/** Rechaza si la promesa no termina dentro de `ms` milisegundos. */
export async function conTiempoLimite<T>(
  promesa: Promise<T>,
  ms: number,
): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error('tiempo límite agotado')),
      ms,
    );
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}
