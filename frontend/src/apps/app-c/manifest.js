export const appCManifest = {
  schemaVersion: '1.0', id: 'appC', title: 'App C', shortTitle: 'App C',
  description: 'Modul aplikasi C Portal Azko Kudus Sudirman.', icon: 'app', category: 'Operasional',
  version: '0.4.2', route: 'appC', order: 40, menu: true, enabled: true,
  requiredPermission: 'appC.access', tags: ['operasional','app-c'], standalone: false,
  capabilities: { offline: false, cache: true, notifications: false, backgroundSync: false },
  internalMenu: [], loader: () => import('./index.js')
};
