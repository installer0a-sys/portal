export const appBManifest = {
  schemaVersion: '1.0', id: 'appB', title: 'App B', shortTitle: 'App B',
  description: 'Modul aplikasi B Portal Azko Kudus Sudirman.', icon: 'app', category: 'Operasional',
  version: '0.4.6', route: 'appB', order: 30, menu: true, enabled: true,
  requiredPermission: 'appB.access', tags: ['operasional','app-b'], standalone: false,
  capabilities: { offline: false, cache: true, notifications: false, backgroundSync: false },
  internalMenu: [], loader: () => import('./index.js')
};
