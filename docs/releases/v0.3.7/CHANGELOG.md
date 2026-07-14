# Changelog — User-Scoped Cache Engine v0.3.7

## Added

- User-scoped cache keys
- Permission-signature isolation
- Session-version isolation
- App namespace isolation
- Data-version isolation
- TTL expiration
- Memory and localStorage modes
- `remember()` cache helper
- Selective invalidation
- Automatic stale-item pruning
- Cache diagnostics
- Portal SDK cache namespace

## Logout behavior

Logout does not delete persistent cache.

The runtime cache context is reset to `anonymous`.
A different user receives a different cache scope and cannot read
the previous user's data.
