# Rollback Guide — Manifest System v0.3.5

Restore these files from the backup:

- frontend/src/apps/registry.js
- frontend/src/apps/dashboard/manifest.js
- frontend/src/apps/app-a/manifest.js
- frontend/src/sdk/portal-sdk.js

Then remove:

```bash
rm -f frontend/src/apps/manifest-schema.js
```

Build and push the rollback.
