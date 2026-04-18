#!/usr/bin/env bash
# Submit a WhatsApp message template defined in infra/templates/<name>.json.
# Usage: ./push-template.sh <template_name>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "usage: $0 <template_name>"
  echo "       looks for infra/templates/<name>.json"
  exit 1
fi

TEMPLATE_FILE="$SCRIPT_DIR/../templates/$NAME.json"
if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "template file not found: $TEMPLATE_FILE" >&2
  exit 1
fi

echo "Submitting $NAME from $TEMPLATE_FILE ..."
resp="$(curl -sS -X POST \
  "$GRAPH_BASE/$META_WA_BUSINESS_ACCOUNT_ID/message_templates" \
  -H "Authorization: Bearer $META_WA_TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$TEMPLATE_FILE")"

echo "$resp" | jq .

# Exit non-zero if Meta returned an error
if echo "$resp" | jq -e '.error' >/dev/null; then
  exit 2
fi
