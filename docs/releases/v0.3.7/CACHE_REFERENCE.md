# Cache Reference — v0.3.7

## Store data

```javascript
Portal.cache.set(
  {
    appId: 'appA',
    namespace: 'schedule',
    key: 'week-2026-29',
    dataVersion: '1',
    ttlMs: 300000
  },
  data
);
```

## Read data

```javascript
const data = Portal.cache.get({
  appId: 'appA',
  namespace: 'schedule',
  key: 'week-2026-29',
  dataVersion: '1'
});
```

## Load or reuse cache

```javascript
const result = await Portal.cache.remember(
  {
    appId: 'appA',
    namespace: 'schedule',
    key: 'week-2026-29',
    ttlMs: 300000
  },
  () => callApi('appA.schedule.list')
);

console.log(result.source);
console.log(result.value);
```

## Invalidate App A cache

```javascript
Portal.cache.invalidate({
  appId: 'appA'
});
```

## Important

Never put passwords, raw session tokens, password hashes,
or security secrets in the cache.
