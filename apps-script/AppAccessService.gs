function normalizeAppRole_(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeAppAccessStatus_(value) {
  const status = String(value || 'ACTIVE').trim().toUpperCase();
  if (['ACTIVE', 'INACTIVE'].indexOf(status) < 0) {
    const error = new Error('Status akses aplikasi harus ACTIVE atau INACTIVE.');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return status;
}

function getAppRoleMasterMap_() {
  const sheet = getPortalSpreadsheet_().getSheetByName('APP_ROLE_MASTER');
  const result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  const headers = getSheetHeaders_(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  rows.forEach(function(row) {
    const item = rowToObject_(headers, row);
    const appId = String(item.APP_ID || '').trim();
    const role = normalizeAppRole_(item.ROLE);
    if (!appId || !role || String(item.STATUS || 'ACTIVE').toUpperCase() !== 'ACTIVE') return;
    if (!result[appId]) result[appId] = [];
    if (result[appId].indexOf(role) < 0) result[appId].push(role);
  });
  Object.keys(result).forEach(function(appId) { result[appId].sort(); });
  return result;
}

function validateRoleForApp_(appId, role) {
  const normalized = normalizeAppRole_(role);
  if (!normalized) return '';
  const roleMap = getAppRoleMasterMap_();
  const allowed = roleMap[String(appId || '')] || [];
  if (allowed.indexOf(normalized) < 0) {
    const error = new Error('Role ' + normalized + ' tidak terdaftar untuk aplikasi ini. Sinkronkan CONFIG_WEB terlebih dahulu.');
    error.code = 'VALIDATION_ERROR';
    error.field = 'appRole';
    throw error;
  }
  return normalized;
}

function getManagedUserAppAccessMap_() {
  const result = {};
  const accessSheet = getPortalSpreadsheet_().getSheetByName('USER_APP_ACCESS');
  const roleSheet = getPortalSpreadsheet_().getSheetByName('USER_APP_ROLE');

  if (accessSheet && accessSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(accessSheet);
    accessSheet.getRange(2, 1, accessSheet.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers, row);
      const userId = String(item.USER_ID || '');
      const appId = String(item.APP_ID || '');
      if (!userId || !appId || String(item.ACCESS || '').toUpperCase() !== 'TRUE') return;
      if (!result[userId]) result[userId] = {};
      result[userId][appId] = {
        access: true,
        status: normalizeAppAccessStatus_(item.STATUS || 'ACTIVE'),
        role: ''
      };
    });
  }

  if (roleSheet && roleSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(roleSheet);
    roleSheet.getRange(2, 1, roleSheet.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
      const item = rowToObject_(headers, row);
      const userId = String(item.USER_ID || '');
      const appId = String(item.APP_ID || '');
      if (!result[userId] || !result[userId][appId]) return;
      result[userId][appId].role = normalizeAppRole_(item.ROLE);
    });
  }
  return result;
}

function replaceManagedUserAppAccess_(userId, appAccess) {
  const accessSheet = getPortalSpreadsheet_().getSheetByName('USER_APP_ACCESS');
  const roleSheet = getPortalSpreadsheet_().getSheetByName('USER_APP_ROLE');
  if (!accessSheet || !roleSheet) throw new Error('Sheet akses aplikasi belum tersedia. Jalankan setupPortalSheets().');

  const incoming = appAccess || {};
  const now = new Date();
  rewriteUserScopedRows_(accessSheet, userId, Object.keys(incoming).filter(function(appId) {
    return incoming[appId] && incoming[appId].access === true;
  }).map(function(appId) {
    const entry = incoming[appId] || {};
    return {
      USER_ID: userId,
      APP_ID: appId,
      ACCESS: true,
      STATUS: normalizeAppAccessStatus_(entry.status || 'ACTIVE'),
      CREATED_AT: now,
      UPDATED_AT: now
    };
  }));

  rewriteUserScopedRows_(roleSheet, userId, Object.keys(incoming).filter(function(appId) {
    return incoming[appId] && incoming[appId].access === true && normalizeAppRole_(incoming[appId].role);
  }).map(function(appId) {
    const role = validateRoleForApp_(appId, incoming[appId].role);
    return { USER_ID: userId, APP_ID: appId, ROLE: role, CREATED_AT: now, UPDATED_AT: now };
  }));
}

function rewriteUserScopedRows_(sheet, userId, records) {
  const headers = getSheetHeaders_(sheet);
  const existingRows = sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];
  const kept = existingRows.filter(function(row) {
    return String(row[headers.indexOf('USER_ID')]) !== String(userId);
  });
  const output = kept.concat(records.map(function(record) {
    return headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    });
  }));
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  if (output.length) sheet.getRange(2, 1, output.length, headers.length).setValues(output);
}

function migrateLegacyUserAppRoles_() {
  const legacy = getPortalSpreadsheet_().getSheetByName('USER_APP_ROLES');
  const accessSheet = getPortalSpreadsheet_().getSheetByName('USER_APP_ACCESS');
  const roleSheet = getPortalSpreadsheet_().getSheetByName('USER_APP_ROLE');
  if (!legacy || legacy.getLastRow() < 2 || accessSheet.getLastRow() > 1 || roleSheet.getLastRow() > 1) return;
  const headers = getSheetHeaders_(legacy);
  const now = new Date();
  const grouped = {};
  legacy.getRange(2, 1, legacy.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
    const item = rowToObject_(headers, row);
    if (String(item.STATUS || 'ACTIVE').toUpperCase() !== 'ACTIVE') return;
    const userId = String(item.USER_ID || '');
    const appId = String(item.APP_ID || '');
    if (!userId || !appId) return;
    if (!grouped[userId]) grouped[userId] = {};
    grouped[userId][appId] = { access: true, status: 'ACTIVE', role: normalizeAppRole_(item.ROLE) };
  });
  Object.keys(grouped).forEach(function(userId) { replaceManagedUserAppAccess_(userId, grouped[userId]); });
}

function seedDefaultAppRoles_(ss) {
  const sheet = ss.getSheetByName('APP_ROLE_MASTER');
  const appsSheet = ss.getSheetByName('APPS');
  if (!sheet || !appsSheet || appsSheet.getLastRow() < 2) return;
  const appHeaders = getSheetHeaders_(appsSheet);
  const apps = appsSheet.getRange(2, 1, appsSheet.getLastRow() - 1, appHeaders.length).getValues().map(function(row) {
    return rowToObject_(appHeaders, row);
  }).filter(function(app) {
    return String(app.APP_ID || '') !== 'portal' && !app.DELETED_AT;
  });
  const records = [];
  apps.forEach(function(app) {
    ['ADMIN', 'USER'].forEach(function(role) {
      records.push({
        ROLE_KEY: String(app.APP_ID) + '|' + role,
        APP_ID: String(app.APP_ID),
        ROLE: role,
        DESCRIPTION: role === 'ADMIN' ? 'Akses penuh aplikasi' : 'Akses baca saja',
        STATUS: 'ACTIVE',
        SOURCE_HASH: '',
        SYNC_AT: new Date()
      });
    });
  });
  upsertRowsByKey_(sheet, 'ROLE_KEY', records, { preserveExisting: true });
}

function seedLegacyAppRoles_(ss) {
  const legacy = ss.getSheetByName('USER_APP_ROLES');
  const master = ss.getSheetByName('APP_ROLE_MASTER');
  if (!legacy || !master || legacy.getLastRow() < 2) return;
  const headers = getSheetHeaders_(legacy);
  const records = [];
  legacy.getRange(2, 1, legacy.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
    const item = rowToObject_(headers, row);
    const appId = String(item.APP_ID || '');
    const role = normalizeAppRole_(item.ROLE);
    if (!appId || !role) return;
    records.push({ ROLE_KEY: appId + '|' + role, APP_ID: appId, ROLE: role, DESCRIPTION: 'Role hasil migrasi v0.4.9', STATUS: 'ACTIVE', SOURCE_HASH: 'LEGACY', SYNC_AT: new Date() });
  });
  upsertRowsByKey_(master, 'ROLE_KEY', records, { preserveExisting: true });
}

function syncAppRoleMasterFromCache_(ss) {
  const cacheSheet = ss.getSheetByName('APP_CONFIG_CACHE');
  const master = ss.getSheetByName('APP_ROLE_MASTER');
  if (!cacheSheet || !master || cacheSheet.getLastRow() < 2) return;
  const headers = getSheetHeaders_(cacheSheet);
  const records = [];
  cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, headers.length).getValues().forEach(function(row) {
    const item = rowToObject_(headers, row);
    const appId = String(item.APP_ID || '');
    if (!appId) return;
    let config = {};
    try { config = JSON.parse(String(item.CONFIG_JSON || '{}')); } catch (ignored) { return; }
    extractRoleDefinitions_(config).forEach(function(definition) {
      const role = normalizeAppRole_(typeof definition === 'string' ? definition : definition.role || definition.name || definition.id);
      if (!role) return;
      records.push({
        ROLE_KEY: appId + '|' + role,
        APP_ID: appId,
        ROLE: role,
        DESCRIPTION: typeof definition === 'object' ? String(definition.description || definition.label || '') : '',
        STATUS: 'ACTIVE',
        SOURCE_HASH: String(item.CONFIG_HASH || ''),
        SYNC_AT: new Date()
      });
    });
  });
  upsertRowsByKey_(master, 'ROLE_KEY', records, { preserveExisting: false });
}

function extractRoleDefinitions_(config) {
  const candidates = [
    config && config.roles,
    config && config.appRoles,
    config && config.roleOptions,
    config && config.access && config.access.roles,
    config && config.permissions && config.permissions.roles
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    if (Array.isArray(candidates[i])) return candidates[i];
    if (candidates[i] && typeof candidates[i] === 'object') {
      return Object.keys(candidates[i]).map(function(key) {
        const value = candidates[i][key];
        return typeof value === 'object' ? Object.assign({ role: key }, value) : key;
      });
    }
  }
  return [];
}
