#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${API_URL:-}" ]]; then
  if curl -fsS "http://127.0.0.1:4100/api/health" >/dev/null 2>&1; then
    API_URL="http://127.0.0.1:4100/api"
  else
    API_URL="http://127.0.0.1:4000/api"
  fi
fi

login() {
  local email="$1"
  local password="$2"
  curl -sS -X POST "$API_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}"
}

json_field() {
  local expr="$1"
  node -pe "$expr"
}

api_get() {
  local token="$1"
  local path="$2"
  curl -sS "$API_URL$path" -H "Authorization: Bearer $token"
}

api_post() {
  local token="$1"
  local path="$2"
  local payload="$3"
  curl -sS -X POST "$API_URL$path" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

echo "[scenario-disruption] Logging in operator and business"
OPS_TOKEN="$(login 'ops@port.com' '123456' | json_field "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")"
BIZ_TOKEN="$(login 'biz@logistics.com' '123456' | json_field "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")"

echo "[scenario-disruption] Creating impacted booking on ZONE_B with CONT-003"
REQUEST="$(api_post "$BIZ_TOKEN" '/business/pickup-requests' '{"containerId":"CONT-003","priority":false}')"
REQUEST_ID="$(printf '%s' "$REQUEST" | json_field "JSON.parse(require('fs').readFileSync(0,'utf8')).request.id")"
SLOT_START="$(printf '%s' "$REQUEST" | json_field "JSON.parse(require('fs').readFileSync(0,'utf8')).recommendation.slotStart")"
SLOT_END="$(printf '%s' "$REQUEST" | json_field "JSON.parse(require('fs').readFileSync(0,'utf8')).recommendation.slotEnd")"
api_post "$BIZ_TOKEN" "/business/bookings/$REQUEST_ID/confirm" "{\"requestId\":\"$REQUEST_ID\",\"slotStart\":\"$SLOT_START\",\"slotEnd\":\"$SLOT_END\"}" >/dev/null

echo "[scenario-disruption] Triggering ZONE_B override"
DISRUPTION="$(api_post "$OPS_TOKEN" '/operator/override/block' '{"targetType":"ZONE","targetId":"ZONE_B","reason":"Crane QC-03 breakdown"}')"
printf '%s\n' "$DISRUPTION"

echo "[scenario-disruption] Waiting for BullMQ re-optimization"
sleep 2

echo "[scenario-disruption] Impacted bookings"
api_get "$OPS_TOKEN" '/operator/monitor/impacted'
