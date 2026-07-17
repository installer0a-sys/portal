function setupPortalSheets_() {
  const ss = SpreadsheetApp.getActive();
  const definitions = [
    ['CONFIG', ['KEY','VALUE','TYPE','DESCRIPTION','UPDATED_AT']],
    ['USERS', ['USER_ID','USERNAME','DISPLAY_NAME','PASSWORD_HASH','PASSWORD_SALT','STATUS','PORTAL_ROLE','SESSION_VERSION','CREATED_AT','UPDATED_AT']],
    ['USER_APP_ROLES', ['USER_ID','APP_ID','ROLE','STATUS','CREATED_AT','UPDATED_AT']],
    ['USER_APP_ACCESS', ['USER_ID','APP_ID','ACCESS','STATUS','CREATED_AT','UPDATED_AT']],
    ['USER_APP_ROLE', ['USER_ID','APP_ID','ROLE','CREATED_AT','UPDATED_AT']],
    ['APP_ROLE_MASTER', ['ROLE_KEY','APP_ID','ROLE','DESCRIPTION','STATUS','SOURCE_HASH','SYNC_AT']],
    ['ROLE_PERMISSIONS', ['APP_ID','ROLE','PERMISSION','DESCRIPTION']],
    ['SESSIONS', ['SESSION_ID','USER_ID','TOKEN_HASH','EXPIRES_AT','STATUS','CREATED_AT','LAST_SEEN_AT','SESSION_VERSION']],
    ['APPS', ['APP_ID','APP_NAME','DESCRIPTION','SPREADSHEET_ID','CONFIG_SHEET','STANDALONE_URL','ICON','CATEGORY','STATUS','ENABLED','DIRECT_PWA','SORT_ORDER','CACHE_TTL_SECONDS','CONFIG_VERSION','CONFIG_HASH','CONFIG_SYNCED_AT','CREATED_AT','UPDATED_AT','DELETED_AT']],
    ['APP_CONFIG_CACHE', ['APP_ID','CONFIG_VERSION','CONFIG_JSON','CONFIG_HASH','CACHED_AT','SOURCE_SPREADSHEET_ID','SOURCE_SHEET']],
    ['AUDIT_LOG', ['TIMESTAMP','REQUEST_ID','USER_ID','ACTION','STATUS','DURATION_MS','DETAILS']],
    ['SYSTEM_LOG', ['TIMESTAMP','LEVEL','SOURCE','MESSAGE','REQUEST_ID','DETAILS']]
  ];

  listDatasetDefinitions_().forEach(function(item) {
    definitions.push([item.definition.sheetName, item.definition.headers]);
  });

  definitions.forEach(function(definition) {
    ensureSheetStructure_(ss, definition[0], definition[1]);
  });

  seedConfig_(ss);
  seedApps_(ss);
  seedPermissions_(ss);
  seedDefaultAppRoles_(ss);
  seedLegacyAppRoles_(ss);
  syncAppRoleMasterFromCache_(ss);
  migrateLegacyUserAppRoles_();
  ensureAuthPepper_();
  return success_({
    schemaVersion: PORTAL_SCHEMA_VERSION,
    sheets: definitions.map(function(item) { return item[0]; })
  }, 'Struktur sheet dan migrasi data berhasil diperiksa.');
}

function setupPortalSheets() {
  return setupPortalSheets_();
}

function setupAuthenticationFoundation() {
  setupPortalSheets_();
  return success_({ ready: true }, 'Fondasi autentikasi siap.');
}

function ensureSheetStructure_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const currentHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
    : [];

  headers.forEach(function(header) {
    if (currentHeaders.indexOf(header) < 0) currentHeaders.push(header);
  });

  if (currentHeaders.length > 0) {
    sheet.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, currentHeaders.length)
      .setFontWeight('bold')
      .setBackground('#1d4ed8')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, currentHeaders.length);
  }
}

function seedConfig_(ss) {
  upsertRowsByKey_(ss.getSheetByName('CONFIG'), 'KEY', [
    { KEY: 'PORTAL_NAME', VALUE: 'Portal Azko Kudus Sudirman', TYPE: 'STRING', DESCRIPTION: 'Nama portal', UPDATED_AT: new Date() },
    { KEY: 'PORTAL_VERSION', VALUE: PORTAL_VERSION, TYPE: 'STRING', DESCRIPTION: 'Versi backend', UPDATED_AT: new Date() },
    { KEY: 'SCHEMA_VERSION', VALUE: String(PORTAL_SCHEMA_VERSION), TYPE: 'NUMBER', DESCRIPTION: 'Versi struktur Spreadsheet', UPDATED_AT: new Date() },
    { KEY: 'MAINTENANCE_MODE', VALUE: 'FALSE', TYPE: 'BOOLEAN', DESCRIPTION: 'Mode pemeliharaan', UPDATED_AT: new Date() },
    { KEY: 'SESSION_TTL_MINUTES', VALUE: '480', TYPE: 'NUMBER', DESCRIPTION: 'Masa sesi login', UPDATED_AT: new Date() }
  ]);
}

function seedApps_(ss) {
  upsertRowsByKey_(ss.getSheetByName('APPS'), 'APP_ID', [
    { APP_ID: 'portal', APP_NAME: 'Portal Utama', DESCRIPTION: 'Shell utama portal', CONFIG_SHEET: 'CONFIG_WEB', STATUS: 'ACTIVE', ENABLED: true, DIRECT_PWA: true, SORT_ORDER: 1, CACHE_TTL_SECONDS: 900 },
    { APP_ID: 'appA', APP_NAME: 'App A', DESCRIPTION: 'Aplikasi A', CONFIG_SHEET: 'CONFIG_WEB', STATUS: 'ACTIVE', ENABLED: true, DIRECT_PWA: true, SORT_ORDER: 10, CACHE_TTL_SECONDS: 900 },
    { APP_ID: 'appB', APP_NAME: 'App B', DESCRIPTION: 'Aplikasi B', CONFIG_SHEET: 'CONFIG_WEB', STATUS: 'ACTIVE', ENABLED: true, DIRECT_PWA: false, SORT_ORDER: 20, CACHE_TTL_SECONDS: 900 },
    { APP_ID: 'appC', APP_NAME: 'App C', DESCRIPTION: 'Aplikasi C', CONFIG_SHEET: 'CONFIG_WEB', STATUS: 'ACTIVE', ENABLED: true, DIRECT_PWA: false, SORT_ORDER: 30, CACHE_TTL_SECONDS: 900 },
    { APP_ID: 'appD', APP_NAME: 'App D', DESCRIPTION: 'Aplikasi D', CONFIG_SHEET: 'CONFIG_WEB', STATUS: 'ACTIVE', ENABLED: true, DIRECT_PWA: false, SORT_ORDER: 40, CACHE_TTL_SECONDS: 900 },
    { APP_ID: 'appE', APP_NAME: 'App E', DESCRIPTION: 'Aplikasi E', CONFIG_SHEET: 'CONFIG_WEB', STATUS: 'ACTIVE', ENABLED: true, DIRECT_PWA: false, SORT_ORDER: 50, CACHE_TTL_SECONDS: 900 }
  ], { preserveExisting: true });
}

function seedPermissions_(ss) {
  const sheet = ss.getSheetByName('ROLE_PERMISSIONS');
  const headers = getSheetHeaders_(sheet);
  const existing = {};
  if (sheet.getLastRow() >= 2) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    rows.forEach(function(row) {
      const item = rowToObject_(headers, row);
      existing[String(item.APP_ID) + '|' + String(item.ROLE).toUpperCase() + '|' + String(item.PERMISSION)] = true;
    });
  }

  const definitions = [
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.access', DESCRIPTION: 'Akses portal' },
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.settings', DESCRIPTION: 'Kelola pengaturan' },
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.apps.view', DESCRIPTION: 'Lihat registry aplikasi' },
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.apps.manage', DESCRIPTION: 'Kelola registry aplikasi' },
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.users.view', DESCRIPTION: 'Lihat daftar user' },
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.users.manage', DESCRIPTION: 'Kelola user dan role' },
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.logs.view', DESCRIPTION: 'Lihat central logs' },
    { APP_ID: 'portal', ROLE: 'USER', PERMISSION: 'portal.access', DESCRIPTION: 'Akses portal' }
  ];

  const appsSheet = ss.getSheetByName('APPS');
  if (appsSheet && appsSheet.getLastRow() >= 2) {
    const appHeaders = getSheetHeaders_(appsSheet);
    appsSheet.getRange(2, 1, appsSheet.getLastRow() - 1, appHeaders.length).getValues().forEach(function(row) {
      const app = rowToObject_(appHeaders, row);
      const appId = String(app.APP_ID || '').trim();
      if (!appId || appId === 'portal' || app.DELETED_AT) return;

      definitions.push(
        { APP_ID: appId, ROLE: 'ADMIN', PERMISSION: appId + '.access', DESCRIPTION: 'Buka aplikasi' },
        { APP_ID: appId, ROLE: 'ADMIN', PERMISSION: appId + '.manage', DESCRIPTION: 'Kelola aplikasi' },
        { APP_ID: appId, ROLE: 'ADMIN', PERMISSION: appId + '.data.view', DESCRIPTION: 'Lihat data' },
        { APP_ID: appId, ROLE: 'ADMIN', PERMISSION: appId + '.data.create', DESCRIPTION: 'Tambah data' },
        { APP_ID: appId, ROLE: 'ADMIN', PERMISSION: appId + '.data.edit', DESCRIPTION: 'Ubah data' },
        { APP_ID: appId, ROLE: 'ADMIN', PERMISSION: appId + '.data.delete', DESCRIPTION: 'Hapus dan pulihkan data' },
        { APP_ID: appId, ROLE: 'USER', PERMISSION: appId + '.access', DESCRIPTION: 'Buka aplikasi' },
        { APP_ID: appId, ROLE: 'USER', PERMISSION: appId + '.data.view', DESCRIPTION: 'Akses baca saja' }
      );
    });
  }

  definitions.forEach(function(record) {
    record.ROLE = String(record.ROLE || '').toUpperCase();
    const key = record.APP_ID + '|' + record.ROLE + '|' + record.PERMISSION;
    if (!existing[key]) {
      sheet.appendRow(headers.map(function(header) { return record[header] || ''; }));
      existing[key] = true;
    }
  });
}
function upsertRowsByKey_(sheet, keyHeader, records, options) {
  const settings = options || {};
  const headers = getSheetHeaders_(sheet);
  const keyIndex = headers.indexOf(keyHeader);
  const existing = {};
  if (sheet.getLastRow() >= 2) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    rows.forEach(function(row, index) {
      existing[String(row[keyIndex])] = index + 2;
    });
  }

  records.forEach(function(record) {
    const row = headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    });
    const key = String(record[keyHeader]);
    if (existing[key]) {
      if (settings.preserveExisting) {
        const current = sheet.getRange(existing[key], 1, 1, headers.length).getValues()[0];
        const merged = headers.map(function(header, index) {
          const incoming = Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
          return current[index] !== '' && current[index] != null ? current[index] : incoming;
        });
        sheet.getRange(existing[key], 1, 1, headers.length).setValues([merged]);
      } else {
        sheet.getRange(existing[key], 1, 1, headers.length).setValues([row]);
      }
    } else {
      sheet.appendRow(row);
    }
  });
}

function createInitialAdmin() {
  const properties = PropertiesService.getScriptProperties();
  const username = properties.getProperty('INITIAL_ADMIN_USERNAME');
  const password = properties.getProperty('INITIAL_ADMIN_PASSWORD');

  if (!username || !password) {
    throw new Error('Atur Script Properties INITIAL_ADMIN_USERNAME dan INITIAL_ADMIN_PASSWORD terlebih dahulu.');
  }

  const user = createUser_({
    username: username,
    password: password,
    portalRole: 'ADMIN'
  });
  ['appA', 'appB', 'appC', 'appD', 'appE'].forEach(function(appId) {
    addUserAppRole_(user.userId, appId, 'MANAGER');
  });

  properties.deleteProperty('INITIAL_ADMIN_PASSWORD');
  properties.deleteProperty('INITIAL_ADMIN_USERNAME');

  return success_({ user: user }, 'Admin pertama berhasil dibuat. Properti password telah dihapus.');
}
