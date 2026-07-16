export const appDManifest = {
  schemaVersion: '1.0', id: 'appD', title: 'App D', shortTitle: 'App D',
  description: 'Modul aplikasi D Portal Azko Kudus Sudirman.', icon: 'app', category: 'Operasional',
  version: '0.4.2', route: 'appD', order: 50, menu: true, enabled: true,
  requiredPermission: 'appD.access', tags: ['operasional','app-d'], standalone: false,
  capabilities: { offline: false, cache: true, notifications: false, backgroundSync: false },
  internalMenu: [], loader: () => import('./index.js')
};
