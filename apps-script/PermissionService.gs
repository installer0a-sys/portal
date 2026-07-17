function getUserAccess_(user) {
  const ss = getPortalSpreadsheet_();
  const accessSheet = ss.getSheetByName('USER_APP_ACCESS');
  const roleSheet = ss.getSheetByName('USER_APP_ROLE');
  const permissionSheet = ss.getSheetByName('ROLE_PERMISSIONS');
  const apps = {};

  if (accessSheet && accessSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(accessSheet);
    accessSheet.getRange(2, 1, accessSheet.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers, row);
      if (String(item.USER_ID) !== String(user.USER_ID) || String(item.ACCESS || '').toUpperCase() !== 'TRUE') return;
      const appId = String(item.APP_ID || '').trim();
      if (!appId) return;
      apps[appId] = { access: true, status: String(item.STATUS || 'ACTIVE').toUpperCase(), role: '' };
    });
  }

  if (roleSheet && roleSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(roleSheet);
    roleSheet.getRange(2, 1, roleSheet.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers, row);
      const appId = String(item.APP_ID || '').trim();
      if (String(item.USER_ID) === String(user.USER_ID) && apps[appId]) apps[appId].role = String(item.ROLE || '').trim().toUpperCase();
    });
  }

  const appRoles = {};
  Object.keys(apps).forEach(function(appId) { if (apps[appId].role) appRoles[appId] = apps[appId].role; });
  const permissions = [];
  if (permissionSheet && permissionSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(permissionSheet);
    permissionSheet.getRange(2, 1, permissionSheet.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers, row);
      const appId = String(item.APP_ID || '');
      const role = String(item.ROLE || '').toUpperCase();
      const expectedRole = appId === 'portal' ? String(user.PORTAL_ROLE || '').toUpperCase() : String(appRoles[appId] || '').toUpperCase();
      if (expectedRole && expectedRole === role) permissions.push(String(item.PERMISSION || ''));
    });
  }
  const dynamicPermissionSheet = ss.getSheetByName('APP_ROLE_PERMISSION_MASTER');
  if (dynamicPermissionSheet && dynamicPermissionSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(dynamicPermissionSheet);
    dynamicPermissionSheet.getRange(2, 1, dynamicPermissionSheet.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers, row);
      const appId = String(item.APP_ID || '').trim();
      const role = String(item.ROLE || '').trim().toUpperCase();
      if (!appId || !role || String(item.STATUS || 'ACTIVE').toUpperCase() !== 'ACTIVE') return;
      if (String(appRoles[appId] || '').toUpperCase() === role) permissions.push(String(item.PERMISSION || '').trim());
    });
  }

  const uniquePermissions = Array.from(new Set(permissions.filter(Boolean))).sort();
  return {
    portalRole: String(user.PORTAL_ROLE || 'USER').toUpperCase(),
    apps: apps,
    appRoles: appRoles,
    permissions: uniquePermissions,
    permissionSignature: createPermissionSignature_(user, apps, uniquePermissions)
  };
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

  const role = String(appAccess.role || '').trim().toUpperCase();
  if (!role) return false;

  // Semua role terdaftar boleh membuka aplikasi. Ini mencegah app shell
  // memunculkan penolakan palsu hanya karena ROLE_PERMISSIONS belum disinkronkan.
  if (required === appId + '.access') return true;

  // Hak bawaan lintas aplikasi.
  if (role === 'ADMIN') return true;
  if (role === 'USER' && (required === appId + '.data.view' || required === appId + '.data.list' || required === appId + '.data.get')) return true;

  return false;
}

function requirePermission_(sessionContext, permission) {
  if (!hasPermission_(sessionContext, permission)) {
    const error = new Error('Anda tidak memiliki izin untuk menjalankan aksi ini.');
    error.code = 'FORBIDDEN';
    throw error;
  }
}
