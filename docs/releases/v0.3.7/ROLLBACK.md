# Rollback Guide — Cache Engine v0.3.7

Restore:

- frontend/src/auth/auth.js
- frontend/src/sdk/portal-sdk.js
- frontend/src/core/diagnostics.js

Then remove:

```bash
rm -f frontend/src/core/cache.js
```

Build, commit, and push.
