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

json_get() {
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

print_pass() {
  echo "[PASS] $1"
}

print_fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

echo "[smoke] Checking health"
HEALTH="$(curl -sS "$API_URL/health")"
printf '%s' "$HEALTH" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!x.ok) process.exit(1); 'ok'" >/dev/null || print_fail "Health endpoint"
print_pass "Health endpoint"

echo "[smoke] Logging in 4 demo roles"
OPS_TOKEN="$(login 'ops@port.com' '123456' | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")"
BIZ_TOKEN="$(login 'biz@logistics.com' '123456' | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")"
DRIVER_TOKEN="$(login 'driver@fleet.com' '123456' | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")"
AUTH_TOKEN="$(login 'admin@authority.gov' '123456' | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")"
print_pass "Role logins"

echo "[smoke] Creating green-path pickup CONT-001"
REQUEST_001="$(api_post "$BIZ_TOKEN" '/business/pickup-requests' '{"containerId":"CONT-001","priority":false}')"
printf '%s' "$REQUEST_001" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(x.finalDecision !== 'RECOMMENDED' || x.recommendation.riskScore >= 50) process.exit(1); 'ok'" >/dev/null || print_fail "CONT-001 recommendation"
REQUEST_ID_001="$(printf '%s' "$REQUEST_001" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).request.id")"
SLOT_START_001="$(printf '%s' "$REQUEST_001" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).recommendation.slotStart")"
SLOT_END_001="$(printf '%s' "$REQUEST_001" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).recommendation.slotEnd")"
print_pass "CONT-001 recommendation"

echo "[smoke] Confirming booking"
CONFIRM_001="$(api_post "$BIZ_TOKEN" "/business/bookings/$REQUEST_ID_001/confirm" "{\"requestId\":\"$REQUEST_ID_001\",\"slotStart\":\"$SLOT_START_001\",\"slotEnd\":\"$SLOT_END_001\"}")"
printf '%s' "$CONFIRM_001" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(x.booking.status !== 'CONFIRMED' || x.assignment.status !== 'NEW') process.exit(1); 'ok'" >/dev/null || print_fail "Booking confirm"
ASSIGNMENT_ID_001="$(printf '%s' "$CONFIRM_001" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).assignment.id")"
print_pass "Booking confirm"

echo "[smoke] Updating driver pickup states"
for STATUS in ENROUTE ARRIVED_GATE PICKED_UP DEPARTED DELIVERED; do
  RESPONSE="$(api_post "$DRIVER_TOKEN" "/driver/assignments/$ASSIGNMENT_ID_001/status" "{\"status\":\"$STATUS\",\"lat\":10.845,\"lng\":106.81}")"
  printf '%s' "$RESPONSE" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(x.status !== '$STATUS') process.exit(1); 'ok'" >/dev/null || print_fail "Driver status $STATUS"
done
print_pass "Driver pickup state machine"

echo "[smoke] Running smart empty return"
RETURN_EMPTY="$(api_post "$DRIVER_TOKEN" '/driver/return-empty' "{\"assignmentId\":\"$ASSIGNMENT_ID_001\",\"currentLat\":10.845,\"currentLng\":106.81}")"
printf '%s' "$RETURN_EMPTY" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!x.recommendation.depotName || x.recommendation.trafficLevel === undefined) process.exit(1); 'ok'" >/dev/null || print_fail "Smart empty return"
RETURN_ASSIGNMENT_ID="$(printf '%s' "$RETURN_EMPTY" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).assignment.id")"
for STATUS in RETURN_EMPTY_STARTED RETURNED; do
  RESPONSE="$(api_post "$DRIVER_TOKEN" "/driver/assignments/$RETURN_ASSIGNMENT_ID/status" "{\"status\":\"$STATUS\",\"lat\":10.846,\"lng\":106.802}")"
  printf '%s' "$RESPONSE" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(x.status !== '$STATUS') process.exit(1); 'ok'" >/dev/null || print_fail "Return-empty status $STATUS"
done
print_pass "Smart empty return"

echo "[smoke] Verifying HOLD path CONT-013"
HTTP_AND_BODY="$(mktemp)"
curl -sS -o "$HTTP_AND_BODY" -w "%{http_code}" -X POST "$API_URL/business/pickup-requests" \
  -H "Authorization: Bearer $BIZ_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"containerId":"CONT-013","priority":false}' > "$HTTP_AND_BODY.code"
STATUS_CODE="$(cat "$HTTP_AND_BODY.code")"
BODY="$(cat "$HTTP_AND_BODY")"
rm -f "$HTTP_AND_BODY" "$HTTP_AND_BODY.code"
if [[ "$STATUS_CODE" != "409" ]]; then
  print_fail "CONT-013 blocked path"
fi
printf '%s' "$BODY" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(x.reason !== 'COMMERCIAL_HOLD') process.exit(1); 'ok'" >/dev/null || print_fail "CONT-013 blocked reason"
print_pass "CONT-013 blocked path"

echo "[smoke] Triggering disruption scenario"
REQUEST_003="$(api_post "$BIZ_TOKEN" '/business/pickup-requests' '{"containerId":"CONT-003","priority":false}')"
REQUEST_ID_003="$(printf '%s' "$REQUEST_003" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).request.id")"
SLOT_START_003="$(printf '%s' "$REQUEST_003" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).recommendation.slotStart")"
SLOT_END_003="$(printf '%s' "$REQUEST_003" | json_get "JSON.parse(require('fs').readFileSync(0,'utf8')).recommendation.slotEnd")"
api_post "$BIZ_TOKEN" "/business/bookings/$REQUEST_ID_003/confirm" "{\"requestId\":\"$REQUEST_ID_003\",\"slotStart\":\"$SLOT_START_003\",\"slotEnd\":\"$SLOT_END_003\"}" >/dev/null
api_post "$OPS_TOKEN" '/operator/override/block' '{"targetType":"ZONE","targetId":"ZONE_B","reason":"Crane QC-03 breakdown"}' >/dev/null
sleep 2
IMPACTED="$(api_get "$OPS_TOKEN" '/operator/monitor/impacted')"
printf '%s' "$IMPACTED" | json_get "const a=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!a.some(x => x.request.container.containerNo === 'CONT-003' && x.status === 'RESCHEDULED')) process.exit(1); 'ok'" >/dev/null || print_fail "Disruption re-optimization"
print_pass "Disruption re-optimization"

echo "[smoke] Generating ESG report"
TODAY="$(date -u +%F)"
ESG="$(api_post "$AUTH_TOKEN" "/authority/esg/generate?date=$TODAY" '{}')"
printf '%s' "$ESG" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(x.idleTimeSaved == null || x.details?.dieselSavedLiters == null) process.exit(1); 'ok'" >/dev/null || print_fail "Authority ESG generate"
ROI="$(api_get "$BIZ_TOKEN" "/business/reports/roi?from=$(date -u -d '-7 day' +%F)&to=$TODAY")"
printf '%s' "$ROI" | json_get "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); if(x.summary.idleTimeSaved == null || x.summary.fuelCostSavedUsd == null || !Array.isArray(x.driverBreakdown)) process.exit(1); 'ok'" >/dev/null || print_fail "Business ROI report"
print_pass "Authority ESG and Business ROI"

echo "[smoke] Completed successfully"
