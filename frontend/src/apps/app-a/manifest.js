export const appAManifest = {
  schemaVersion: '1.0',
  id: 'appA',
  title: 'App A',
  shortTitle: 'App A',
  description:
    'Aplikasi pertama Portal V3.',
  icon: 'app',
  category: 'Operasional',
  version: '0.4.6',
  route: 'appA',
  order: 20,
  menu: true,
  enabled: true,
  requiredPermission:
    'appA.access',
  tags: [
    'operasional',
    'app-a'
  ],
  standalone: {
    enabled: true,
    path: '/portal/app-a/',
    manifestPath:
      '/portal/manifests/app-a.webmanifest',
    installable: true
  },
  capabilities: {
    offline: false,
    cache: true,
    notifications: false,
    backgroundSync: false
  },

  /*
   * Metadata menu internal ini belum mengubah tampilan.
   * Akan dipakai saat App Shell UI dibuat nanti.
   */
  internalMenu: [
    {
      id: 'overview',
      title: 'Ringkasan',
      icon: 'home',
      route: 'overview',
      order: 10,
      default: true,
      enabled: true,
      requiredPermission:
        'appA.access'
    },
    {
      id: 'schedule',
      title: 'Jadwal',
      icon: 'calendar',
      route: 'schedule',
      order: 20,
      enabled: true,
      requiredPermission:
        'appA.schedule.view'
    },
    {
      id: 'manager',
      title: 'Manager',
      icon: 'users',
      route: 'manager',
      order: 30,
      enabled: true,
      requiredPermission:
        'appA.manager.view'
    },
    {
      id: 'report',
      title: 'Laporan',
      icon: 'report',
      route: 'report',
      order: 40,
      enabled: true,
      requiredPermission:
        'appA.report.view'
    },
    {
      id: 'settings',
      title: 'Pengaturan',
      icon: 'settings',
      route: 'settings',
      order: 50,
      enabled: true,
      requiredPermission:
        'appA.settings.view'
    }
  ],

  loader: () =>
    import('./index.js')
};
