function getUserAccess_(user) {
  const ss = getPortalSpreadsheet_();
  const accessMap = getManagedUserAppAccessMap_();
  const apps = accessMap[String(user.USER_ID)] || {};
  const appRoles = {};
  Object.keys(apps).forEach(function(appId) {
    const roles = Array.isArray(apps[appId].roles) ? apps[appId].roles : (apps[appId].role ? [apps[appId].role] : []);
    appRoles[appId] = roles;
    apps[appId].role = roles[0] || '';
  });
  const permissions = [];
  const permissionSheet = ss.getSheetByName('ROLE_PERMISSIONS');
  if (permissionSheet && permissionSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(permissionSheet);
    permissionSheet.getRange(2,1,permissionSheet.getLastRow()-1,headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers,row);
      const appId = String(item.APP_ID || '');
      const role = String(item.ROLE || '').toUpperCase();
      const expectedRoles = appId === 'portal' ? [String(user.PORTAL_ROLE || '').toUpperCase()] : (appRoles[appId] || []);
      if (expectedRoles.indexOf(role) >= 0) permissions.push(String(item.PERMISSION || ''));
    });
  }
  const dynamic = ss.getSheetByName('APP_ROLE_PERMISSION_MASTER');
  if (dynamic && dynamic.getLastRow() >= 2) {
    const headers = getSheetHeaders_(dynamic);
    dynamic.getRange(2,1,dynamic.getLastRow()-1,headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers,row);
      const appId = String(item.APP_ID || '').trim();
      const role = String(item.ROLE || '').trim().toUpperCase();
      if ((appRoles[appId] || []).indexOf(role) >= 0 && String(item.STATUS || 'ACTIVE').toUpperCase() === 'ACTIVE') permissions.push(String(item.PERMISSION || '').trim());
    });
  }
  Object.keys(appRoles).forEach(function(appId) {
    const roles = appRoles[appId] || [];
    if (roles.length) permissions.push(appId + '.access');
    if (roles.indexOf('ADMIN') >= 0) permissions.push(appId + '.*');
    if (roles.indexOf('USER') >= 0) ['data.view','data.list','data.get','schedule.view','dashboard.view','export','screenshot'].forEach(function(permission) { permissions.push(appId + '.' + permission); });
  });
  const uniquePermissions = Array.from(new Set(permissions.filter(Boolean))).sort();
  return { portalRole: String(user.PORTAL_ROLE || 'USER').toUpperCase(), apps: apps, appRoles: appRoles, permissions: uniquePermissions, permissionSignature: createPermissionSignature_(user, apps, uniquePermissions) };
}

function createPermissionSignature_(user, apps, permissions) {
  const source = JSON.stringify({ userId: String(user.USER_ID || ''), sessionVersion: Number(user.SESSION_VERSION || 1), portalRole: String(user.PORTAL_ROLE || ''), apps: apps, permissions: permissions });
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8)).slice(0, 20);
}
function hasPermission_(sessionContext, permission) {
  if (!sessionContext || !sessionContext.access) return false;

  const required = String(permission || '').trim();
  const granted = sessionContext.access.permissions || [];
  if (!required) return true;
  if (granted.indexOf(required) >= 0 || granted.indexOf('*') >= 0) return true;

  for (let i = 0; i < granted.length; i += 1) {
    const item = String(granted[i] || '').trim();
    if (item.slice(-2) === '.*' && required.indexOf(item.slice(0, -1)) === 0) return true;
  }

  const separator = required.indexOf('.');
  if (separator < 1) return false;
  const appId = required.slice(0, separator);
  if (appId === 'portal') return false;

  const appAccess = sessionContext.access.apps && sessionContext.access.apps[appId];
  if (!appAccess || appAccess.access !== true || String(appAccess.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return false;

  const roles = Array.isArray(appAccess.roles) ? appAccess.roles.map(function(role) { return String(role || '').trim().toUpperCase(); }) : [String(appAccess.role || '').trim().toUpperCase()].filter(Boolean);
  if (!roles.length) return false;

  // Semua role terdaftar boleh membuka aplikasi. Ini mencegah app shell
  // memunculkan penolakan palsu hanya karena ROLE_PERMISSIONS belum disinkronkan.
  if (required === appId + '.access') return true;

  // Hak bawaan lintas aplikasi.
  if (roles.indexOf('ADMIN') >= 0) return true;
  if (roles.indexOf('USER') >= 0 && (required === appId + '.data.view' || required === appId + '.data.list' || required === appId + '.data.get')) return true;

  return false;
}

function requirePermission_(sessionContext, permission) {
  if (!hasPermission_(sessionContext, permission)) {
    const error = new Error('Anda tidak memiliki izin untuk menjalankan aksi ini.');
    error.code = 'FORBIDDEN';
    throw error;
  }
}
