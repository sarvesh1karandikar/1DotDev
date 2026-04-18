#!/usr/bin/env bash
# Poll a template's status every 10s until it leaves PENDING.
# Usage: ./poll-template.sh <template_name>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "usage: $0 <template_name>"
  exit 1
fi

echo "Polling status of $NAME (every 10s, Ctrl-C to stop)..."
while true; do
  resp="$(curl -sS "$GRAPH_BASE/$META_WA_BUSINESS_ACCOUNT_ID/message_templates?name=$NAME&fields=name,status,category,language,rejected_reason" \
    -H "Authorization: Bearer $META_WA_TOKEN")"

  status="$(echo "$resp" | jq -r '.data[0].status // "NOT_FOUND"')"
  rejected_reason="$(echo "$resp" | jq -r '.data[0].rejected_reason // ""')"
  ts="$(date +'%H:%M:%S')"

  case "$status" in
    APPROVED)
      echo "[$ts] ✅ APPROVED"
      exit 0
      ;;
    REJECTED)
      echo "[$ts] ❌ REJECTED — $rejected_reason"
      exit 3
      ;;
    PAUSED|DISABLED|IN_APPEAL|PENDING_DELETION)
      echo "[$ts] ⚠  $status — manual review needed"
      exit 4
      ;;
    PENDING|"")
      echo "[$ts] ⏳ PENDING..."
      ;;
    NOT_FOUND)
      echo "[$ts] template not found (not submitted yet?)"
      exit 5
      ;;
    *)
      echo "[$ts] unknown status: $status"
      ;;
  esac
  sleep 10
done
