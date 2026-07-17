const APP_REGISTRY_PROTECTED_IDS = Object.freeze(['portal']);
const APP_REGISTRY_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE']);

function listRegisteredApps_(context, payload) {
  requirePermission_(context, 'portal.apps.view');
  const input = requireObject_(payload || {}, 'payload');
  const includeDeleted = Boolean(input.includeDeleted) && hasPermission_(context, 'portal.apps.manage');
  const includeInactive = Boolean(input.includeInactive) && hasPermission_(context, 'portal.apps.manage');
  const sheet = requireAppRegistrySheet_();
  const records = readSheetObjects_(sheet)
    .filter(function(record) { return includeDeleted || !record.DELETED_AT; })
    .filter(function(record) { return includeInactive || normalizeAppStatus_(record) === 'ACTIVE'; })
    .sort(compareAppOrder_)
    .map(sanitizeAppRecord_);
  return success_({ apps: records }, 'Daftar aplikasi berhasil dimuat.');
}

function getRegisteredApp_(context, payload) {
  requirePermission_(context, 'portal.apps.view');
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);
  const found = findAppRegistryRecord_(appId);
  if (!found || found.data.DELETED_AT) throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi tidak ditemukan.');
  return success_({ app: sanitizeAppRecord_(found.data) }, 'Aplikasi ditemukan.');
}

function createRegisteredApp_(context, payload, requestId) {
  requirePermission_(context, 'portal.apps.manage');
  const input = requireObject_(payload || {}, 'payload');
  const values = validateAppRegistryValues_(input, true);
  if (findAppRegistryRecord_(values.APP_ID)) throwAppRegistryError_('APP_ID_EXISTS', 'App ID sudah digunakan.');

  return withAppRegistryLock_(function() {
    const sheet = requireAppRegistrySheet_();
    const headers = getSheetHeaders_(sheet);
    const now = new Date();
    const record = Object.assign({
      ENABLED: true,
      STATUS: 'ACTIVE',
      DIRECT_PWA: false,
      SORT_ORDER: nextAppSortOrder_(sheet),
      CONFIG_SHEET: 'CONFIG_WEB',
      CACHE_TTL_SECONDS: 900,
      CONFIG_VERSION: '',
      CONFIG_HASH: '',
      CONFIG_SYNCED_AT: '',
      CREATED_AT: now,
      UPDATED_AT: now,
      DELETED_AT: ''
    }, values);
    sheet.appendRow(headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    }));
    seedPermissionsForApp_(record.APP_ID, record.APP_NAME);
    writeAppRegistryAudit_(context, requestId, 'app.create', record.APP_ID, { appName: record.APP_NAME });
    return success_({ app: sanitizeAppRecord_(record) }, 'Aplikasi berhasil ditambahkan.');
  });
}

function updateRegisteredApp_(context, payload, requestId) {
  requirePermission_(context, 'portal.apps.manage');
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);
  const values = validateAppRegistryValues_(input.values || {}, false);
  delete values.APP_ID;
  if (!Object.keys(values).length) throwAppRegistryError_('VALIDATION_ERROR', 'Tidak ada perubahan yang dapat disimpan.');

  return withAppRegistryLock_(function() {
    const found = findAppRegistryRecord_(appId);
    if (!found || found.data.DELETED_AT) throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi tidak ditemukan.');
    const updated = Object.assign({}, found.data, values, { UPDATED_AT: new Date() });
    writeAppRegistryRow_(found.rowNumber, updated);
    writeAppRegistryAudit_(context, requestId, 'app.update', appId, { fields: Object.keys(values) });
    return success_({ app: sanitizeAppRecord_(updated) }, 'Aplikasi berhasil diperbarui.');
  });
}

function deleteRegisteredApp_(context, payload, requestId) {
  requirePermission_(context, 'portal.apps.manage');
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);
  if (APP_REGISTRY_PROTECTED_IDS.indexOf(appId) >= 0) {
    throwAppRegistryError_('APP_PROTECTED', 'Aplikasi inti portal tidak dapat dihapus.');
  }

  return withAppRegistryLock_(function() {
    const found = findAppRegistryRecord_(appId);
    if (!found || found.data.DELETED_AT) throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi tidak ditemukan.');
    const deleted = Object.assign({}, found.data, {
      ENABLED: false,
      STATUS: 'INACTIVE',
      UPDATED_AT: new Date(),
      DELETED_AT: new Date()
    });
    writeAppRegistryRow_(found.rowNumber, deleted);
    writeAppRegistryAudit_(context, requestId, 'app.delete', appId, {});
    return success_({ appId: appId }, 'Aplikasi dihapus dari katalog. Spreadsheet sumber tidak diubah.');
  });
}

function restoreRegisteredApp_(context, payload, requestId) {
  requirePermission_(context, 'portal.apps.manage');
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);

  return withAppRegistryLock_(function() {
    const found = findAppRegistryRecord_(appId);
    if (!found || !found.data.DELETED_AT) throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi terhapus tidak ditemukan.');
    const restored = Object.assign({}, found.data, {
      ENABLED: true,
      STATUS: 'ACTIVE',
      UPDATED_AT: new Date(),
      DELETED_AT: ''
    });
    writeAppRegistryRow_(found.rowNumber, restored);
    writeAppRegistryAudit_(context, requestId, 'app.restore', appId, {});
    return success_({ app: sanitizeAppRecord_(restored) }, 'Aplikasi berhasil dipulihkan.');
  });
}

function moveRegisteredApp_(context, payload, requestId) {
  requirePermission_(context, 'portal.apps.manage');
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);
  const direction = requireEnum_(input.direction, 'direction', ['UP', 'DOWN']);

  return withAppRegistryLock_(function() {
    const sheet = requireAppRegistrySheet_();
    const records = readSheetObjectsWithRows_(sheet)
      .filter(function(item) { return !item.data.DELETED_AT; })
      .sort(function(left, right) { return compareAppOrder_(left.data, right.data); });
    const index = records.findIndex(function(item) { return String(item.data.APP_ID) === appId; });
    if (index < 0) throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi tidak ditemukan.');
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= records.length) {
      return success_({ app: sanitizeAppRecord_(records[index].data) }, 'Posisi aplikasi tidak berubah.');
    }
    const current = records[index];
    const target = records[targetIndex];
    const currentOrder = Number(current.data.SORT_ORDER || (index + 1) * 10);
    const targetOrder = Number(target.data.SORT_ORDER || (targetIndex + 1) * 10);
    current.data.SORT_ORDER = targetOrder;
    target.data.SORT_ORDER = currentOrder;
    current.data.UPDATED_AT = new Date();
    target.data.UPDATED_AT = new Date();
    writeAppRegistryRow_(current.rowNumber, current.data);
    writeAppRegistryRow_(target.rowNumber, target.data);
    normalizeAppSortOrders_();
    const moved = findAppRegistryRecord_(appId);
    writeAppRegistryAudit_(context, requestId, 'app.move', appId, { direction: direction });
    return success_({ app: sanitizeAppRecord_(moved.data) }, 'Posisi aplikasi berhasil dipindahkan.');
  });
}

function validateRegisteredAppConnection_(context, payload) {
  requirePermission_(context, 'portal.apps.manage');
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);
  const found = findAppRegistryRecord_(appId);
  if (!found || found.data.DELETED_AT) throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi tidak ditemukan.');
  const source = openAppSource_(found.data);
  const configSheetName = String(found.data.CONFIG_SHEET || 'CONFIG_WEB');
  const configSheet = source.getSheetByName(configSheetName);
  return success_({
    appId: appId,
    spreadsheetName: source.getName(),
    spreadsheetId: source.getId(),
    configSheet: configSheetName,
    configSheetFound: Boolean(configSheet)
  }, configSheet ? 'Koneksi Spreadsheet dan CONFIG_WEB berhasil.' : 'Spreadsheet terhubung, tetapi sheet config belum ditemukan.');
}

function requireAppRegistrySheet_() {
  const sheet = getPortalSpreadsheet_().getSheetByName('APPS');
  if (!sheet) throwAppRegistryError_('REGISTRY_NOT_READY', 'Registry aplikasi belum tersedia. Jalankan setupPortalSheets().');
  return sheet;
}

function findAppRegistryRecord_(appId) {
  const sheet = requireAppRegistrySheet_();
  const headers = getSheetHeaders_(sheet);
  const idIndex = headers.indexOf('APP_ID');
  if (sheet.getLastRow() < 2 || idIndex < 0) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index][idIndex]) === String(appId)) {
      return { rowNumber: index + 2, data: rowToObject_(headers, rows[index]) };
    }
  }
  return null;
}

function validateAppRegistryValues_(input, isCreate) {
  const values = requireObject_(input || {}, 'values');
  const output = {};
  if (isCreate || Object.prototype.hasOwnProperty.call(values, 'appId')) output.APP_ID = requireAppId_(values.appId);
  if (isCreate || Object.prototype.hasOwnProperty.call(values, 'appName')) output.APP_NAME = requireString_(values.appName, 'appName', { required: isCreate, maxLength: 100 });
  if (Object.prototype.hasOwnProperty.call(values, 'description')) output.DESCRIPTION = requireString_(values.description, 'description', { maxLength: 1000 });
  if (Object.prototype.hasOwnProperty.call(values, 'spreadsheetId')) output.SPREADSHEET_ID = requireString_(values.spreadsheetId, 'spreadsheetId', { maxLength: 200 });
  if (Object.prototype.hasOwnProperty.call(values, 'configSheet')) output.CONFIG_SHEET = requireString_(values.configSheet, 'configSheet', { maxLength: 100 }) || 'CONFIG_WEB';
  if (Object.prototype.hasOwnProperty.call(values, 'standaloneUrl')) output.STANDALONE_URL = requireString_(values.standaloneUrl, 'standaloneUrl', { maxLength: 1000 });
  if (Object.prototype.hasOwnProperty.call(values, 'icon')) output.ICON = requireString_(values.icon, 'icon', { maxLength: 100 });
  if (Object.prototype.hasOwnProperty.call(values, 'category')) output.CATEGORY = requireString_(values.category, 'category', { maxLength: 100 });
  if (Object.prototype.hasOwnProperty.call(values, 'status')) {
    output.STATUS = requireEnum_(values.status, 'status', APP_REGISTRY_STATUSES, 'ACTIVE');
    output.ENABLED = output.STATUS === 'ACTIVE';
  }
  if (Object.prototype.hasOwnProperty.call(values, 'enabled')) {
    output.ENABLED = Boolean(values.enabled);
    output.STATUS = output.ENABLED ? 'ACTIVE' : 'INACTIVE';
  }
  if (Object.prototype.hasOwnProperty.call(values, 'directPwa')) output.DIRECT_PWA = Boolean(values.directPwa);
  if (Object.prototype.hasOwnProperty.call(values, 'sortOrder')) output.SORT_ORDER = requirePositiveInteger_(values.sortOrder, 'sortOrder', 10, 100000);
  if (Object.prototype.hasOwnProperty.call(values, 'cacheTtlSeconds')) output.CACHE_TTL_SECONDS = requirePositiveInteger_(values.cacheTtlSeconds, 'cacheTtlSeconds', 900, 21600);
  return output;
}

function requireAppId_(value) {
  const appId = requireString_(value, 'appId', { required: true, minLength: 3, maxLength: 40 });
  if (!/^[a-z][A-Za-z0-9_-]*$/.test(appId)) {
    throwValidation_('appId', 'harus diawali huruf kecil dan hanya berisi huruf, angka, garis bawah, atau strip.');
  }
  return appId;
}

function sanitizeAppRecord_(record) {
  return {
    appId: String(record.APP_ID || ''),
    appName: String(record.APP_NAME || ''),
    description: String(record.DESCRIPTION || ''),
    spreadsheetId: String(record.SPREADSHEET_ID || ''),
    configSheet: String(record.CONFIG_SHEET || 'CONFIG_WEB'),
    standaloneUrl: String(record.STANDALONE_URL || ''),
    icon: String(record.ICON || ''),
    category: String(record.CATEGORY || ''),
    status: normalizeAppStatus_(record),
    enabled: normalizeAppStatus_(record) === 'ACTIVE',
    directPwa: toBoolean_(record.DIRECT_PWA),
    sortOrder: Number(record.SORT_ORDER || 0),
    cacheTtlSeconds: Number(record.CACHE_TTL_SECONDS || 900),
    configVersion: String(record.CONFIG_VERSION || ''),
    configHash: String(record.CONFIG_HASH || ''),
    configSyncedAt: toIsoString_(record.CONFIG_SYNCED_AT),
    createdAt: toIsoString_(record.CREATED_AT),
    updatedAt: toIsoString_(record.UPDATED_AT),
    deletedAt: toIsoString_(record.DELETED_AT)
  };
}

function normalizeAppStatus_(record) {
  if (record.DELETED_AT) return 'DELETED';
  const explicit = String(record.STATUS || '').toUpperCase();
  if (APP_REGISTRY_STATUSES.indexOf(explicit) >= 0) return explicit;
  return toBoolean_(record.ENABLED) ? 'ACTIVE' : 'INACTIVE';
}

function toBoolean_(value) {
  if (value === true || value === 1) return true;
  return ['TRUE', 'YA', 'YES', '1', 'ACTIVE'].indexOf(String(value || '').trim().toUpperCase()) >= 0;
}

function toIsoString_(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function compareAppOrder_(left, right) {
  const orderDiff = Number(left.SORT_ORDER || 0) - Number(right.SORT_ORDER || 0);
  return orderDiff || String(left.APP_NAME || '').localeCompare(String(right.APP_NAME || ''));
}

function readSheetObjects_(sheet) {
  return readSheetObjectsWithRows_(sheet).map(function(item) { return item.data; });
}

function readSheetObjectsWithRows_(sheet) {
  const headers = getSheetHeaders_(sheet);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map(function(row, index) {
    return { rowNumber: index + 2, data: rowToObject_(headers, row) };
  });
}

function writeAppRegistryRow_(rowNumber, record) {
  const sheet = requireAppRegistrySheet_();
  const headers = getSheetHeaders_(sheet);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  })]);
}

function nextAppSortOrder_(sheet) {
  const records = readSheetObjects_(sheet);
  return records.reduce(function(max, record) { return Math.max(max, Number(record.SORT_ORDER || 0)); }, 0) + 10;
}

function normalizeAppSortOrders_() {
  const sheet = requireAppRegistrySheet_();
  const records = readSheetObjectsWithRows_(sheet)
    .filter(function(item) { return !item.data.DELETED_AT; })
    .sort(function(left, right) { return compareAppOrder_(left.data, right.data); });
  records.forEach(function(item, index) {
    item.data.SORT_ORDER = (index + 1) * 10;
    writeAppRegistryRow_(item.rowNumber, item.data);
  });
}

function openAppSource_(record) {
  const spreadsheetId = requireString_(record.SPREADSHEET_ID, 'spreadsheetId', { required: true, maxLength: 200 });
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throwAppRegistryError_('APP_SOURCE_UNAVAILABLE', 'Spreadsheet aplikasi tidak dapat dibuka. Periksa ID dan izin akses Apps Script.');
  }
}

function withAppRegistryLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throwAppRegistryError_('WRITE_BUSY', 'Registry sedang diperbarui. Silakan coba kembali.');
  try { return callback(); } finally { lock.releaseLock(); }
}

function seedPermissionsForApp_(appId, appName) {
  const sheet = getPortalSpreadsheet_().getSheetByName('ROLE_PERMISSIONS');
  if (!sheet) return;
  const headers = getSheetHeaders_(sheet);
  const existing = {};
  readSheetObjects_(sheet).forEach(function(record) {
    existing[String(record.APP_ID) + '|' + String(record.ROLE) + '|' + String(record.PERMISSION)] = true;
  });
  const definitions = [
    { APP_ID: appId, ROLE: 'MANAGER', PERMISSION: appId + '.access', DESCRIPTION: 'Akses ' + appName },
    { APP_ID: appId, ROLE: 'MANAGER', PERMISSION: appId + '.manage', DESCRIPTION: 'Kelola ' + appName },
    { APP_ID: appId, ROLE: 'VIEWER', PERMISSION: appId + '.access', DESCRIPTION: 'Lihat ' + appName }
  ];
  definitions.forEach(function(record) {
    const key = record.APP_ID + '|' + record.ROLE + '|' + record.PERMISSION;
    if (!existing[key]) sheet.appendRow(headers.map(function(header) { return record[header] || ''; }));
  });
}

function writeAppRegistryAudit_(context, requestId, action, appId, details) {
  writeAuditLog_({
    requestId: requestId || '',
    userId: String(context && context.user && context.user.USER_ID || ''),
    action: action,
    status: 'SUCCESS',
    details: Object.assign({ appId: appId }, details || {})
  });
}

function throwAppRegistryError_(code, message) {
  const error = new Error(message || 'Operasi aplikasi gagal.');
  error.code = code || 'APP_REGISTRY_ERROR';
  throw error;
}
