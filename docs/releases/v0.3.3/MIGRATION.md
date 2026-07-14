# Migration Guide — v0.3.3

Old pattern:

```javascript
const result = await callApi('appA.ping');
toast.success('Berhasil.');
```

New pattern:

```javascript
const result = await queueManager.run({
  id: 'appA.ping',
  label: 'Tes App A',
  successMessage: 'Berhasil.',
  task: () => callApi('appA.ping')
});
```

Rules:

1. Every write or refresh action must have a stable queue ID.
2. Do not call success/error toast manually for queued tasks.
3. Disable the triggering button while the task is running.
4. Use `mode: "drop"` for duplicate prevention.
