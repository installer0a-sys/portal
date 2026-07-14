#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-all}"
MESSAGE="${2:-Portal update}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$MODE" == "frontend" || "$MODE" == "all" ]]; then
  cd "$ROOT/frontend"
  npm run build
  cd "$ROOT"
  git add .
  if ! git diff --cached --quiet; then
    git commit -m "$MESSAGE"
    git push origin main
  else
    echo "Tidak ada perubahan frontend untuk di-push."
  fi
fi

if [[ "$MODE" == "backend" || "$MODE" == "all" ]]; then
  cd "$ROOT/apps-script"
  npx clasp push
  echo "Source Apps Script sudah diperbarui. Update deployment /exec bila memakai deployment versioned."
fi
