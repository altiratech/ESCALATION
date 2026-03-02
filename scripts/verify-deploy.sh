#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="${VERIFY_API_HEALTH_URL:-https://escalation.altiratech.com/api/healthz}"
API_BOOTSTRAP_URL="${VERIFY_API_BOOTSTRAP_URL:-https://escalation.altiratech.com/api/reference/bootstrap}"
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

echo "Verifying web shell: ${WEB_URL}"
web_html="$(curl -fsS "${WEB_URL}")"
if ! grep -Eq 'ESCALATION|WARGAMES|wargames-escalation' <<<"${web_html}"; then
  echo "Web verification failed: expected ESCALATION marker not found" >&2
  exit 1
fi

echo "Deployment verification checks passed."
