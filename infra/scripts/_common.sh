#!/usr/bin/env bash
# Sources credentials and exports them. Prefers AWS SSM (prod path),
# falls back to local .env for dev. Called by other scripts via `source`.

set -euo pipefail

need() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "missing env: $var" >&2
    exit 1
  fi
}

load_from_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

load_from_ssm() {
  local region="${AWS_REGION:-us-east-1}"
  for name in META_WA_TOKEN META_WA_BUSINESS_ACCOUNT_ID; do
    local val
    val="$(aws ssm get-parameter --name "/1dotdev/prod/$name" \
      --with-decryption --region "$region" --query 'Parameter.Value' --output text 2>/dev/null || true)"
    if [[ -n "$val" ]]; then
      export "$name=$val"
    fi
  done
}

# Load order: .env first, then SSM fills anything missing.
load_from_env_file "${LOCAL_ENV_FILE:-$HOME/openclaw/.env}"
if [[ -z "${META_WA_TOKEN:-}" || -z "${META_WA_BUSINESS_ACCOUNT_ID:-}" ]]; then
  load_from_ssm
fi

need META_WA_TOKEN
need META_WA_BUSINESS_ACCOUNT_ID

strip_quotes() { echo "$1" | sed "s/^['\"]//;s/['\"]$//"; }

META_WA_TOKEN="$(strip_quotes "$META_WA_TOKEN")"
META_WA_BUSINESS_ACCOUNT_ID="$(strip_quotes "$META_WA_BUSINESS_ACCOUNT_ID")"

export META_WA_TOKEN META_WA_BUSINESS_ACCOUNT_ID
export GRAPH_BASE="https://graph.facebook.com/v21.0"
