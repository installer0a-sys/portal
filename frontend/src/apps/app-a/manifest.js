export const appAManifest = {
  id: 'appA',
  title: 'App A',
  shortTitle: 'App A',
  description:
    'Aplikasi pertama Portal V3.',
  icon: 'app',
  version: '0.1.0',
  route: 'appA',
  order: 20,
  menu: true,
  standalone: true,
  enabled: true,
  requiredPermission:
    'appA.access',
  loader: () =>
    import('./index.js')
};
