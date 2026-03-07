#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="${VERIFY_API_HEALTH_URL:-https://escalation.altiratech.com/api/healthz}"
API_BOOTSTRAP_URL="${VERIFY_API_BOOTSTRAP_URL:-https://escalation.altiratech.com/api/reference/bootstrap}"
API_PROFILE_URL="${VERIFY_API_PROFILE_URL:-https://escalation.altiratech.com/api/profiles}"
API_EPISODE_START_URL="${VERIFY_API_EPISODE_START_URL:-https://escalation.altiratech.com/api/episodes/start}"
WEB_URL="${VERIFY_WEB_URL:-https://escalation.altiratech.com}"

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
scenario_id="$(python3 - "${bootstrap_tmp}" <<'PY'
import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    data = json.load(handle)
scenarios = data.get("scenarios") or []
if not scenarios:
    raise SystemExit("No scenarios in bootstrap payload")
print(scenarios[0]["id"])
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
if ! grep -Eiq 'Altira Flashpoint|ESCALATION|WARGAMES|wargames-escalation' <<<"${web_html}"; then
  echo "Web verification failed: expected Altira Flashpoint/legacy marker not found" >&2
  exit 1
fi

echo "Deployment verification checks passed."
