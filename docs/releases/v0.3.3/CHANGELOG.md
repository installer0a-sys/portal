# Changelog — Portal Engine v0.3.3

## Added

- Queue Manager
- Loading Manager
- Toast deduplication
- Queue history in Diagnostics
- Loading state in Diagnostics
- Toast state in Diagnostics
- App A API test migrated to Queue Manager

## Behavior

Repeated clicks on the same action while it is running are ignored and share the same operation.

One operation produces:

- one request;
- one loading state;
- one success or error toast.
