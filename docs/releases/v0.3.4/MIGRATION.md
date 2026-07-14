# Migration Guide — Portal SDK v0.3.4

## Old app module

```javascript
export async function mount() {}
export async function unmount() {}
```

## New app module

```javascript
import { defineApp } from '../../sdk/portal-sdk.js';

const app = defineApp({
  id: 'appA',
  async mount() {},
  async refresh() {},
  async pause() {},
  async resume() {},
  async unmount() {}
});

export const {
  mount,
  refresh,
  pause,
  resume,
  unmount
} = app;
```

## New app manifest

```javascript
export const appAManifest = {
  id: 'appA',
  title: 'App A',
  route: 'appA',
  menu: true,
  standalone: true,
  requiredPermission: 'appA.access',
  loader: () => import('./index.js')
};
```
