# Rollback Guide — Portal Event Bus v0.4.0

Restore:

- frontend/src/sdk/portal-sdk.js
- frontend/src/entries/dev-tools.js
- frontend/src/apps/app-a/index.js
- frontend/src/core/diagnostics.js

Then remove:

```bash
rm -f frontend/src/core/event-bus.js
rm -f frontend/src/core/event-bridge.js
```

Build, commit, and push.
