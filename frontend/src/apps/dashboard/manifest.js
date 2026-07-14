export const dashboardManifest = {
  id: 'dashboard',
  title: 'Dashboard',
  shortTitle: 'Dashboard',
  description:
    'Ringkasan Portal AZKO Kudus.',
  icon: 'dashboard',
  version: '0.1.0',
  route: 'dashboard',
  order: 10,
  menu: true,
  standalone: false,
  enabled: true,
  requiredPermission:
    'portal.access',
  loader: () =>
    import('./index.js')
};
