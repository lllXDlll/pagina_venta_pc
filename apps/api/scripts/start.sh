#!/usr/bin/env sh
# Comando de inicio de la API en Render (design D11).
# Con MIGRAR_AL_ARRANCAR=true aplica las migraciones pendientes con DIRECT_URL
# (prisma.config.ts) antes de arrancar. Si la migración falla, el script termina
# con error, la versión nueva no arranca y Render mantiene la anterior.
set -e

cd "$(dirname "$0")/.."

if [ "$MIGRAR_AL_ARRANCAR" = "true" ]; then
  echo "Aplicando migraciones pendientes..."
  ./node_modules/.bin/prisma migrate deploy
else
  echo "MIGRAR_AL_ARRANCAR no es true: se arranca sin migrar."
fi

exec node dist/main.js
