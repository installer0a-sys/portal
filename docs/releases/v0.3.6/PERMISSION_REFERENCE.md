# Permission Reference — v0.3.6

## Exact permission

```javascript
Portal.permission.can(session, 'appA.schedule.view')
```

## Wildcard permission

A granted permission:

```text
appA.*
```

allows:

```text
appA.access
appA.schedule.view
appA.manager.view
```

## Manifest filter

```javascript
Portal.permission.filterManifests(
  session,
  Portal.registry.list()
)
```

## Internal menu filter

```javascript
Portal.permission.filterInternalMenu(
  session,
  manifest.internalMenu
)
```
