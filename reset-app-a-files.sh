#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

rm -f   apps-script/AppAService.gs   apps-script/AppAViewParityService.gs   apps-script/AppAEditorService.gs   apps-script/AppAEditorValidationService.gs   apps-script/AppAGenerateService.gs   apps-script/AppAServiceV062.gs

echo "File bisnis App A lama sudah dihapus."
echo "App Management, APPS registry, permission, user, dan metadata aplikasi tetap dipertahankan."
