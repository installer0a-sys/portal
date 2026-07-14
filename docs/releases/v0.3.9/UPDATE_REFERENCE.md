# Update Manager Reference — v0.3.9

## Current version

```javascript
Portal.update.getCurrentVersion()
```

## Check update

```javascript
await Portal.update.check()
```

## Read state

```javascript
Portal.update.snapshot()
```

## Apply update

```javascript
await Portal.update.apply()
```

`apply()` refreshes service-worker Cache Storage and reloads the page.
User-scoped localStorage cache remains intact.
