# Rollback Guide — Developer Console v0.3.8

Restore:

- frontend/src/sdk/portal-sdk.js
- frontend/index.html
- frontend/app-a/index.html

Then remove:

```bash
rm -f frontend/src/core/developer-console.js
rm -f frontend/src/entries/dev-tools.js
```

Build, commit, and push.
