#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DATABASE_URL="${DATABASE_URL:-postgres://user:password@localhost:5432/freshsync?schema=public}"

echo "[demo-reset] Starting postgres and redis"
docker compose up -d postgres redis

echo "[demo-reset] Applying schema"
pnpm --filter @freshsync/api db:reset

echo "[demo-reset] Reseeding deterministic demo data"
pnpm --filter @freshsync/api db:seed

echo "[demo-reset] FreshSync demo state is ready"
