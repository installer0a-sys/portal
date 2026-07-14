# Rollback Guide — v0.3.3

Before installation, keep the backup folder.

To restore:

```bash
cd ~/project/portal

cp backup-before-queue-v0.3.3/toast.js \
  frontend/src/core/toast.js

cp backup-before-queue-v0.3.3/diagnostics.js \
  frontend/src/core/diagnostics.js

cp backup-before-queue-v0.3.3/app-a-index.js \
  frontend/src/apps/app-a/index.js

rm -f frontend/src/core/loading.js
rm -f frontend/src/core/queue.js

cd frontend
npm run build
```

Then commit and push the rollback.
