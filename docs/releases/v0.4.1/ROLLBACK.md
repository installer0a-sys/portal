# Rollback Guide — Portal Command Bus v0.4.1

Restore:

- frontend/src/sdk/portal-sdk.js
- frontend/src/entries/dev-tools.js
- frontend/src/core/diagnostics.js

Then remove:

```bash
rm -f frontend/src/core/command-bus.js
rm -f frontend/src/core/command-bridge.js
```

Build, commit, and push.
