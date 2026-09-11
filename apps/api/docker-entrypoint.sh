#!/bin/sh
set -e

echo "[api] aplicando migrations (prisma migrate deploy)"
npx prisma migrate deploy

echo "[api] iniciando servidor"
exec node dist/index.js
