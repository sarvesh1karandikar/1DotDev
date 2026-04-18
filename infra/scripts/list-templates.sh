#!/usr/bin/env bash
# List all WhatsApp message templates on the WABA with status.
# Usage: ./list-templates.sh [json]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

resp="$(curl -sS "$GRAPH_BASE/$META_WA_BUSINESS_ACCOUNT_ID/message_templates?fields=name,status,category,language,rejected_reason&limit=100" \
  -H "Authorization: Bearer $META_WA_TOKEN")"

if [[ "${1:-}" == "json" ]]; then
  echo "$resp" | jq .
  exit 0
fi

echo "$resp" | jq -r '
  if .error then
    "ERROR: \(.error.message)"
  else
    (.data // []) as $rows
    | if ($rows | length) == 0 then "no templates"
      else
        (["NAME","STATUS","CATEGORY","LANG","REJECT_REASON"] | @tsv),
        ($rows[] | [.name, .status, .category, .language, (.rejected_reason // "")] | @tsv)
      end
  end
' | column -t -s $'\t'
