# Rollback Guide — Permission Engine v0.3.6

Restore:

- frontend/src/sdk/portal-sdk.js
- frontend/src/core/diagnostics.js
- frontend/src/entries/portal.js
- frontend/src/entries/app-a.js

Then remove:

```bash
rm -f frontend/src/core/permission.js
```

Build, commit, and push.
