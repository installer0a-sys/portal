# Rollback Guide — Version & Update Manager v0.3.9

Restore:

- frontend/src/sdk/portal-sdk.js
- frontend/src/core/diagnostics.js
- frontend/src/entries/dev-tools.js

Then remove:

```bash
rm -f frontend/src/core/version.js
rm -f frontend/src/core/update-manager.js
rm -f frontend/public/version.json
```

Build, commit, and push.
