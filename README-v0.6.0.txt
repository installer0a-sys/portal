Portal v0.6.0 one-time migration

Run once from ~/project/portal/frontend:
  node scripts/apply-v0.6.0-backend.mjs
  node scripts/apply-v0.6.0.mjs
  npm run build

The apply scripts are intentionally NOT included in package.json build.
