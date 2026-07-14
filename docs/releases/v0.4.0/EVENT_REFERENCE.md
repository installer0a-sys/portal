# Event Bus Reference — v0.4.0

## Listen

```javascript
const unsubscribe = Portal.events.on(
  'schedule.saved',
  (payload, context) => {
    console.log(payload, context);
  },
  {
    source: 'dashboard',
    priority: 10
  }
);
```

## Emit

```javascript
await Portal.events.emit(
  'schedule.saved',
  {
    week: 29
  },
  {
    source: 'appA'
  }
);
```

## Listen once

```javascript
Portal.events.once(
  'portal.ready',
  () => {
    console.log('Portal ready');
  }
);
```

## Wildcard listener

```javascript
Portal.events.on(
  '*',
  (_payload, context) => {
    console.log(context.name);
  }
);
```

## Notification event

```javascript
await Portal.events.emit(
  'portal.notification.success',
  {
    message: 'Data berhasil disimpan.',
    key: 'schedule-save-success'
  },
  {
    source: 'appA'
  }
);
```

## Cache invalidation event

```javascript
await Portal.events.emit(
  'portal.cache.invalidate',
  {
    appId: 'appA',
    namespace: 'schedule'
  },
  {
    source: 'appA'
  }
);
```
