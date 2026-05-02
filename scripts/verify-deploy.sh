#!/usr/bin/env bash
set -euo pipefail

API_ORIGIN="${VERIFY_API_ORIGIN:-https://escalation-api.rjameson.workers.dev}"
API_HEALTH_URL="${VERIFY_API_HEALTH_URL:-${API_ORIGIN}/api/healthz}"
API_BOOTSTRAP_URL="${VERIFY_API_BOOTSTRAP_URL:-${API_ORIGIN}/api/reference/bootstrap}"
API_PROFILE_URL="${VERIFY_API_PROFILE_URL:-${API_ORIGIN}/api/profiles}"
API_EPISODE_START_URL="${VERIFY_API_EPISODE_START_URL:-${API_ORIGIN}/api/episodes/start}"
WEB_URL="${VERIFY_WEB_URL:-https://escalation-web.pages.dev}"
EXPECTED_SCENARIO_ID="${VERIFY_SCENARIO_ID:-northern_strait_black_swan}"

echo "Verifying API health: ${API_HEALTH_URL}"
api_health="$(curl -fsS "${API_HEALTH_URL}")"
if ! grep -q '"status":"ok"' <<<"${api_health}"; then
  echo "API health check failed: ${api_health}" >&2
  exit 1
fi

echo "Verifying API bootstrap payload: ${API_BOOTSTRAP_URL}"
api_bootstrap="$(curl -fsS "${API_BOOTSTRAP_URL}")"
if ! grep -q '"scenarios"' <<<"${api_bootstrap}"; then
  echo "API bootstrap check failed: missing scenarios field" >&2
  exit 1
fi
if ! grep -q '"actions"' <<<"${api_bootstrap}"; then
  echo "API bootstrap check failed: missing actions field" >&2
  exit 1
fi

bootstrap_tmp="$(mktemp)"
printf '%s' "${api_bootstrap}" > "${bootstrap_tmp}"
scenario_id="$(python3 - "${bootstrap_tmp}" "${EXPECTED_SCENARIO_ID}" <<'PY'
import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    data = json.load(handle)
expected = sys.argv[2]
scenarios = data.get("scenarios") or []
if not scenarios:
    raise SystemExit("No scenarios in bootstrap payload")
matches = [scenario for scenario in scenarios if scenario.get("id") == expected]
if not matches:
    raise SystemExit(f"Expected scenario not found: {expected}")
scenario = matches[0]
if scenario.get("isLegacy"):
    raise SystemExit(f"Expected scenario is marked legacy: {expected}")
print(scenario["id"])
PY
)"
rm -f "${bootstrap_tmp}"
if [[ -z "${scenario_id}" ]]; then
  echo "API bootstrap check failed: unable to resolve scenario id" >&2
  exit 1
fi

echo "Verifying profile creation: ${API_PROFILE_URL}"
profile_payload="$(printf '{"codename":"SMOKE-%s"}' "$(date +%s)")"
profile_response="$(curl -fsS -X POST "${API_PROFILE_URL}" -H 'Content-Type: application/json' --data "${profile_payload}")"
profile_tmp="$(mktemp)"
printf '%s' "${profile_response}" > "${profile_tmp}"
profile_id="$(python3 - "${profile_tmp}" <<'PY'
import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    data = json.load(handle)
profile_id = data.get("profileId")
if not profile_id:
    raise SystemExit("Profile response missing profileId")
print(profile_id)
PY
)"
rm -f "${profile_tmp}"
if [[ -z "${profile_id}" ]]; then
  echo "Profile verification failed: missing profile id" >&2
  exit 1
fi

echo "Verifying episode start route: ${API_EPISODE_START_URL}"
start_payload="$(printf '{"profileId":"%s","scenarioId":"%s","timerMode":"off"}' "${profile_id}" "${scenario_id}")"
start_response="$(curl -fsS -X POST "${API_EPISODE_START_URL}" -H 'Content-Type: application/json' --data "${start_payload}")"
start_tmp="$(mktemp)"
printf '%s' "${start_response}" > "${start_tmp}"
python3 - "${start_tmp}" <<'PY'
import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    data = json.load(handle)
required_fields = ["episodeId", "scenarioId", "status", "turn", "maxTurns", "offeredActions"]
missing = [field for field in required_fields if field not in data]
if missing:
    raise SystemExit(f"Episode start response missing fields: {', '.join(missing)}")
if data["status"] != "active":
    raise SystemExit(f"Episode did not start as active (status={data['status']})")
if not isinstance(data["offeredActions"], list) or not data["offeredActions"]:
    raise SystemExit("Episode start response has empty offeredActions")
print(f"episode_started={data['episodeId']} turn={data['turn']}")
PY
rm -f "${start_tmp}"

echo "Verifying web shell: ${WEB_URL}"
web_html="$(curl -fsS "${WEB_URL}")"
if ! grep -Eiq 'Altira Flashpoint' <<<"${web_html}"; then
  echo "Web verification failed: expected Altira Flashpoint marker not found" >&2
  exit 1
fi

echo "Deployment verification checks passed."
