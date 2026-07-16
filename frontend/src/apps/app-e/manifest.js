export const appEManifest = {
  schemaVersion: '1.0', id: 'appE', title: 'App E', shortTitle: 'App E',
  description: 'Modul aplikasi E Portal Azko Kudus Sudirman.', icon: 'app', category: 'Operasional',
  version: '0.4.6', route: 'appE', order: 60, menu: true, enabled: true,
  requiredPermission: 'appE.access', tags: ['operasional','app-e'], standalone: false,
  capabilities: { offline: false, cache: true, notifications: false, backgroundSync: false },
  internalMenu: [], loader: () => import('./index.js')
};
