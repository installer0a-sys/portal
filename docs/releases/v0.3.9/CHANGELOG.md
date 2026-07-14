# Changelog — Version & Update Manager v0.3.9

## Added

- Central frontend version metadata
- Public `version.json`
- Remote version check using `cache: no-store`
- Build comparison
- Service worker update request
- Safe PWA runtime cache cleanup
- Update state in diagnostics
- Portal SDK `update` namespace
- Ctrl + Shift + U update check shortcut
- Existing "Cek update" button uses Update Manager

## Important

Applying an update does not delete:

- user-scoped localStorage data cache;
- authentication data cache for other scopes;
- application data stored by Cache Engine.

Only service-worker Cache Storage is refreshed.
