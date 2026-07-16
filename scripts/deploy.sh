#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
MESSAGE="${2:-Portal update}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! "$MODE" =~ ^(frontend|backend|all|check)$ ]]; then
  echo "Mode: frontend | backend | all | check" >&2
  exit 2
fi

cd "$ROOT"
[[ "$(git branch --show-current)" == "main" ]] || { echo "Deployment hanya diizinkan dari branch main." >&2; exit 1; }

echo "== Pemeriksaan frontend =="
cd "$ROOT/frontend"
npm ci
npm run build

if [[ "$MODE" == "check" ]]; then
  echo "Build berhasil. Tidak ada deployment yang dijalankan."
  exit 0
fi

if [[ "$MODE" == "backend" || "$MODE" == "all" ]]; then
  echo "== Push Apps Script =="
  cd "$ROOT/apps-script"
  npx clasp status
  npx clasp push
  echo "Source backend sudah dipush. Untuk deployment versioned, jalankan clasp version lalu clasp deploy --deploymentId ..."
fi

if [[ "$MODE" == "frontend" || "$MODE" == "all" ]]; then
  echo "== Push GitHub =="
  cd "$ROOT"
  git add frontend apps-script scripts .github docs README.md 2>/dev/null || git add frontend apps-script scripts .github
  if git diff --cached --quiet; then
    echo "Tidak ada perubahan untuk di-commit."
  else
    git commit -m "$MESSAGE"
    git push origin main
  fi
fi
