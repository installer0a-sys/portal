function setupPortalSheets_() {
  const ss = SpreadsheetApp.getActive();
  const definitions = [
    ['CONFIG', ['KEY','VALUE','TYPE','DESCRIPTION','UPDATED_AT']],
    ['USERS', ['USER_ID','USERNAME','PASSWORD_HASH','PASSWORD_SALT','STATUS','PORTAL_ROLE','SESSION_VERSION','CREATED_AT','UPDATED_AT']],
    ['USER_APP_ROLES', ['USER_ID','APP_ID','ROLE','STATUS','CREATED_AT','UPDATED_AT']],
    ['ROLE_PERMISSIONS', ['APP_ID','ROLE','PERMISSION','DESCRIPTION']],
    ['SESSIONS', ['SESSION_ID','USER_ID','TOKEN_HASH','EXPIRES_AT','STATUS','CREATED_AT','LAST_SEEN_AT','SESSION_VERSION']],
    ['APPS', ['APP_ID','APP_NAME','ENABLED','DIRECT_PWA','SORT_ORDER','DESCRIPTION']],
    ['AUDIT_LOG', ['TIMESTAMP','REQUEST_ID','USER_ID','ACTION','STATUS','DURATION_MS','DETAILS']],
    ['SYSTEM_LOG', ['TIMESTAMP','LEVEL','SOURCE','MESSAGE','REQUEST_ID','DETAILS']]
  ];

  definitions.forEach(function(definition) {
    ensureSheetStructure_(ss, definition[0], definition[1]);
  });

  seedConfig_(ss);
  seedApps_(ss);
  seedPermissions_(ss);
  ensureAuthPepper_();
  return success_({ sheets: definitions.map(function(item) { return item[0]; }) }, 'Struktur sheet berhasil diperiksa.');
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
    { KEY: 'PORTAL_NAME', VALUE: 'Portal AZKO Kudus', TYPE: 'STRING', DESCRIPTION: 'Nama portal', UPDATED_AT: new Date() },
    { KEY: 'PORTAL_VERSION', VALUE: PORTAL_VERSION, TYPE: 'STRING', DESCRIPTION: 'Versi backend', UPDATED_AT: new Date() },
    { KEY: 'MAINTENANCE_MODE', VALUE: 'FALSE', TYPE: 'BOOLEAN', DESCRIPTION: 'Mode pemeliharaan', UPDATED_AT: new Date() },
    { KEY: 'SESSION_TTL_MINUTES', VALUE: '480', TYPE: 'NUMBER', DESCRIPTION: 'Masa sesi login', UPDATED_AT: new Date() }
  ]);
}

function seedApps_(ss) {
  upsertRowsByKey_(ss.getSheetByName('APPS'), 'APP_ID', [
    { APP_ID: 'portal', APP_NAME: 'Portal Utama', ENABLED: true, DIRECT_PWA: true, SORT_ORDER: 1, DESCRIPTION: 'Shell utama portal' },
    { APP_ID: 'appA', APP_NAME: 'App A', ENABLED: true, DIRECT_PWA: true, SORT_ORDER: 10, DESCRIPTION: 'Aplikasi A' }
  ]);
}

function seedPermissions_(ss) {
  const sheet = ss.getSheetByName('ROLE_PERMISSIONS');
  const headers = getSheetHeaders_(sheet);
  const existing = {};
  if (sheet.getLastRow() >= 2) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    rows.forEach(function(row) {
      const item = rowToObject_(headers, row);
      existing[item.APP_ID + '|' + item.ROLE + '|' + item.PERMISSION] = true;
    });
  }

  const definitions = [
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.access', DESCRIPTION: 'Akses portal' },
    { APP_ID: 'portal', ROLE: 'ADMIN', PERMISSION: 'portal.settings', DESCRIPTION: 'Kelola pengaturan' },
    { APP_ID: 'portal', ROLE: 'USER', PERMISSION: 'portal.access', DESCRIPTION: 'Akses portal' },
    { APP_ID: 'appA', ROLE: 'MANAGER', PERMISSION: 'appA.access', DESCRIPTION: 'Akses App A' },
    { APP_ID: 'appA', ROLE: 'MANAGER', PERMISSION: 'appA.manage', DESCRIPTION: 'Kelola App A' },
    { APP_ID: 'appA', ROLE: 'VIEWER', PERMISSION: 'appA.access', DESCRIPTION: 'Lihat App A' }
  ];

  definitions.forEach(function(record) {
    const key = record.APP_ID + '|' + record.ROLE + '|' + record.PERMISSION;
    if (!existing[key]) {
      sheet.appendRow(headers.map(function(header) { return record[header] || ''; }));
    }
  });
}

function upsertRowsByKey_(sheet, keyHeader, records) {
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
      sheet.getRange(existing[key], 1, 1, headers.length).setValues([row]);
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
  addUserAppRole_(user.userId, 'appA', 'MANAGER');

  properties.deleteProperty('INITIAL_ADMIN_PASSWORD');
  properties.deleteProperty('INITIAL_ADMIN_USERNAME');

  return success_({ user: user }, 'Admin pertama berhasil dibuat. Properti password telah dihapus.');
}
