# Manifest Reference — v0.3.5

```javascript
{
  schemaVersion: '1.0',
  id: 'appA',
  title: 'App A',
  shortTitle: 'App A',
  description: '',
  icon: 'app',
  category: 'Operasional',
  version: '0.1.0',
  route: 'appA',
  order: 20,
  menu: true,
  enabled: true,
  requiredPermission: 'appA.access',
  tags: [],
  standalone: {
    enabled: true,
    path: '/portal/app-a/',
    manifestPath: '',
    installable: true
  },
  capabilities: {
    offline: false,
    cache: true,
    notifications: false,
    backgroundSync: false
  },
  internalMenu: [],
  loader: () => import('./index.js')
}
```
