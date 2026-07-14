export const dashboardManifest = {
  schemaVersion: '1.0',
  id: 'dashboard',
  title: 'Dashboard',
  shortTitle: 'Dashboard',
  description:
    'Ringkasan Portal AZKO Kudus.',
  icon: 'dashboard',
  category: 'Portal',
  version: '0.1.0',
  route: 'dashboard',
  order: 10,
  menu: true,
  enabled: true,
  requiredPermission:
    'portal.access',
  tags: [
    'portal',
    'dashboard'
  ],
  standalone: false,
  capabilities: {
    offline: true,
    cache: true,
    notifications: false,
    backgroundSync: false
  },
  internalMenu: [],
  loader: () =>
    import('./index.js')
};
