# Command Bus Reference — v0.4.1

## Register command

```javascript
const unregister = Portal.commands.register(
  'appA.schedule.refresh',
  async (payload, context) => {
    return {
      refreshed: true,
      week: payload.week
    };
  },
  {
    source: 'appA'
  }
);
```

## Run command

```javascript
await Portal.commands.run(
  'appA.schedule.refresh',
  {
    week: 29
  },
  {
    source: 'dashboard'
  }
);
```

## Check update

```javascript
await Portal.commands.run(
  'portal.update.check',
  {
    notify: true
  }
);
```

## Invalidate cache

```javascript
await Portal.commands.run(
  'portal.cache.invalidate',
  {
    appId: 'appA',
    namespace: 'schedule'
  }
);
```
