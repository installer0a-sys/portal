function getUserAccess_(user) {
  const ss = getPortalSpreadsheet_();
  const appRolesSheet = ss.getSheetByName('USER_APP_ROLES');
  const permissionSheet = ss.getSheetByName('ROLE_PERMISSIONS');

  const appRoles = {};
  if (appRolesSheet && appRolesSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(appRolesSheet);
    const rows = appRolesSheet.getRange(2, 1, appRolesSheet.getLastRow() - 1, headers.length).getValues();
    rows.forEach(function(row) {
      const item = rowToObject_(headers, row);
      if (String(item.USER_ID) === String(user.USER_ID) && String(item.STATUS || 'ACTIVE') === 'ACTIVE') {
        appRoles[String(item.APP_ID)] = String(item.ROLE || '').toUpperCase();
      }
    });
  }

  const permissions = [];
  if (permissionSheet && permissionSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(permissionSheet);
    const rows = permissionSheet.getRange(2, 1, permissionSheet.getLastRow() - 1, headers.length).getValues();
    rows.forEach(function(row) {
      const item = rowToObject_(headers, row);
      const appId = String(item.APP_ID || '');
      const role = String(item.ROLE || '').toUpperCase();
      const expectedRole = appId === 'portal'
        ? String(user.PORTAL_ROLE || '').toUpperCase()
        : String(appRoles[appId] || '').toUpperCase();
      if (expectedRole && expectedRole === role) {
        permissions.push(String(item.PERMISSION || ''));
      }
    });
  }

  const uniquePermissions = Array.from(new Set(permissions.filter(Boolean))).sort();
  return {
    portalRole: String(user.PORTAL_ROLE || 'USER').toUpperCase(),
    appRoles: appRoles,
    permissions: uniquePermissions,
    permissionSignature: createPermissionSignature_(user, appRoles, uniquePermissions)
  };
}

function createPermissionSignature_(user, appRoles, permissions) {
  const source = JSON.stringify({
    userId: String(user.USER_ID || ''),
    sessionVersion: Number(user.SESSION_VERSION || 1),
    portalRole: String(user.PORTAL_ROLE || ''),
    appRoles: appRoles,
    permissions: permissions
  });
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8)).slice(0, 20);
}

function hasPermission_(sessionContext, permission) {
  return sessionContext && sessionContext.access && sessionContext.access.permissions.indexOf(permission) >= 0;
}

function requirePermission_(sessionContext, permission) {
  if (!hasPermission_(sessionContext, permission)) {
    const error = new Error('Anda tidak memiliki izin untuk menjalankan aksi ini.');
    error.code = 'FORBIDDEN';
    throw error;
  }
}
