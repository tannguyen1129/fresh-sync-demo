#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

wait_for_health() {
  local url="$1"
  local retries="${2:-60}"
  local delay="${3:-2}"

  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

echo "[prod-deploy] Building and starting postgres, redis, api, web"
docker compose up -d --build postgres redis api web

echo "[prod-deploy] Waiting for API health on 127.0.0.1:4100"
wait_for_health "http://127.0.0.1:4100/api/health" || {
  echo "[prod-deploy] API health check failed" >&2
  exit 1
}

echo "[prod-deploy] FreshSync app containers are ready"
