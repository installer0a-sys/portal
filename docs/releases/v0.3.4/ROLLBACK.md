# Rollback Guide — Portal SDK v0.3.4

Restore the backup folder created before installation.

Remove new SDK and registry files:

```bash
rm -rf frontend/src/sdk
rm -f frontend/src/apps/registry.js
rm -f frontend/src/apps/manifests.js
rm -f frontend/src/apps/dashboard/manifest.js
rm -f frontend/src/apps/app-a/manifest.js
```

Restore the previous Portal entry, App A entry,
Dashboard module, App A module, and diagnostics file.

Then run:

```bash
cd frontend
npm run build
```
