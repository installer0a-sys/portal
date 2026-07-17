function assertAppManager_(context) {
  requirePermission_(context, 'portal.apps.manage');
}

function normalizeRouteSlug_(value, fallback) {
  const source = String(value || fallback || '').trim().toLowerCase();
  const slug = source.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) {
    const error = new Error('Route aplikasi wajib diisi.');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return slug;
}

function sanitizeRegisteredApp_(item) {
  return {
    appId: String(item.APP_ID || ''),
    appName: String(item.APP_NAME || ''),
    description: String(item.DESCRIPTION || ''),
    spreadsheetId: String(item.SPREADSHEET_ID || ''),
    configSheet: String(item.CONFIG_SHEET || 'CONFIG_WEB'),
    routeSlug: normalizeRouteSlug_(item.ROUTE_SLUG || item.APP_ID, item.APP_ID),
    standaloneUrl: String(item.STANDALONE_URL || ''),
    icon: String(item.ICON || ''),
    category: String(item.CATEGORY || ''),
    status: item.DELETED_AT ? 'DELETED' : String(item.STATUS || 'ACTIVE').toUpperCase(),
    enabled: String(item.ENABLED || '').toUpperCase() !== 'FALSE',
    directPwa: String(item.DIRECT_PWA || '').toUpperCase() === 'TRUE',
    sortOrder: Number(item.SORT_ORDER || 0),
    cacheTtlSeconds: Number(item.CACHE_TTL_SECONDS || 900),
    configVersion: String(item.CONFIG_VERSION || ''),
    configHash: String(item.CONFIG_HASH || ''),
    configSyncedAt: item.CONFIG_SYNCED_AT ? new Date(item.CONFIG_SYNCED_AT).toISOString() : '',
    deletedAt: item.DELETED_AT ? new Date(item.DELETED_AT).toISOString() : ''
  };
}

function readRegisteredApps_() {
  const sheet = getPortalSpreadsheet_().getSheetByName('APPS');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = getSheetHeaders_(sheet);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map(function(row, index) {
    return { rowNumber: index + 2, raw: rowToObject_(headers, row) };
  });
}

function listRegisteredApps_(context, payload) {
  requirePermission_(context, 'portal.apps.view');
  const input = payload || {};
  const apps = readRegisteredApps_().filter(function(record) {
    if (!input.includeDeleted && record.raw.DELETED_AT) return false;
    if (!input.includeInactive && String(record.raw.STATUS || 'ACTIVE').toUpperCase() === 'INACTIVE') return false;
    return true;
  }).map(function(record) { return sanitizeRegisteredApp_(record.raw); }).sort(function(a, b) {
    return a.sortOrder - b.sortOrder || a.appName.localeCompare(b.appName, 'id');
  });
  return success_({ apps: apps, total: apps.length }, 'Registry aplikasi berhasil dimuat.');
}

function findRegisteredAppRecord_(appId) {
  const id = String(appId || '').trim();
  return readRegisteredApps_().find(function(record) { return String(record.raw.APP_ID || '') === id; }) || null;
}

function getRegisteredApp_(context, payload) {
  requirePermission_(context, 'portal.apps.view');
  const found = findRegisteredAppRecord_(payload && payload.appId);
  if (!found) throw Object.assign(new Error('Aplikasi tidak ditemukan.'), { code: 'NOT_FOUND' });
  return success_({ app: sanitizeRegisteredApp_(found.raw) }, 'Aplikasi berhasil dimuat.');
}

function appValuesToRecord_(values, existing) {
  const input = values || {};
  const current = existing || {};
  const appId = String(input.appId || current.APP_ID || '').trim();
  if (!appId) throw Object.assign(new Error('App ID wajib diisi.'), { code: 'VALIDATION_ERROR' });
  return {
    APP_ID: appId,
    APP_NAME: String(input.appName || current.APP_NAME || appId).trim(),
    DESCRIPTION: String(input.description != null ? input.description : current.DESCRIPTION || '').trim(),
    SPREADSHEET_ID: String(input.spreadsheetId != null ? input.spreadsheetId : current.SPREADSHEET_ID || '').trim(),
    CONFIG_SHEET: String(input.configSheet || current.CONFIG_SHEET || 'CONFIG_WEB').trim(),
    ROUTE_SLUG: normalizeRouteSlug_(input.routeSlug || current.ROUTE_SLUG || appId, appId),
    STANDALONE_URL: String(input.standaloneUrl != null ? input.standaloneUrl : current.STANDALONE_URL || '').trim(),
    ICON: String(input.icon != null ? input.icon : current.ICON || '').trim(),
    CATEGORY: String(input.category != null ? input.category : current.CATEGORY || '').trim(),
    STATUS: String(input.status || current.STATUS || 'ACTIVE').toUpperCase(),
    ENABLED: input.enabled == null ? (current.ENABLED === '' ? true : current.ENABLED) : input.enabled,
    DIRECT_PWA: input.directPwa == null ? (current.DIRECT_PWA || false) : input.directPwa,
    SORT_ORDER: Number(input.sortOrder != null ? input.sortOrder : current.SORT_ORDER || 999),
    CACHE_TTL_SECONDS: Math.max(10, Math.min(21600, Number(input.cacheTtlSeconds || current.CACHE_TTL_SECONDS || 900))),
    UPDATED_AT: new Date()
  };
}

function writeRegisteredAppRecord_(sheet, rowNumber, record) {
  const headers = getSheetHeaders_(sheet);
  const row = headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; });
  if (rowNumber) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function createRegisteredApp_(context, payload, requestId) {
  assertAppManager_(context);
  const record = appValuesToRecord_(payload || {}, {});
  if (findRegisteredAppRecord_(record.APP_ID)) throw Object.assign(new Error('App ID sudah terdaftar.'), { code: 'VALIDATION_ERROR' });
  record.CREATED_AT = new Date();
  writeRegisteredAppRecord_(getPortalSpreadsheet_().getSheetByName('APPS'), null, record);
  writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'apps.create', status: 'SUCCESS', details: { appId: record.APP_ID } });
  return success_({ app: sanitizeRegisteredApp_(record) }, 'Aplikasi berhasil ditambahkan.');
}

function updateRegisteredApp_(context, payload, requestId) {
  assertAppManager_(context);
  const found = findRegisteredAppRecord_(payload && payload.appId);
  if (!found) throw Object.assign(new Error('Aplikasi tidak ditemukan.'), { code: 'NOT_FOUND' });
  const record = Object.assign({}, found.raw, appValuesToRecord_(payload.values || {}, found.raw));
  writeRegisteredAppRecord_(getPortalSpreadsheet_().getSheetByName('APPS'), found.rowNumber, record);
  writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'apps.update', status: 'SUCCESS', details: { appId: record.APP_ID, routeSlug: record.ROUTE_SLUG } });
  return success_({ app: sanitizeRegisteredApp_(record) }, 'Aplikasi berhasil diperbarui.');
}

function deleteRegisteredApp_(context, payload, requestId) {
  assertAppManager_(context);
  const found = findRegisteredAppRecord_(payload && payload.appId);
  if (!found) throw Object.assign(new Error('Aplikasi tidak ditemukan.'), { code: 'NOT_FOUND' });
  const record = Object.assign({}, found.raw, { STATUS: 'INACTIVE', DELETED_AT: new Date(), UPDATED_AT: new Date() });
  writeRegisteredAppRecord_(getPortalSpreadsheet_().getSheetByName('APPS'), found.rowNumber, record);
  writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'apps.delete', status: 'SUCCESS', details: { appId: record.APP_ID } });
  return success_(null, 'Aplikasi dihapus dari katalog.');
}

function restoreRegisteredApp_(context, payload, requestId) {
  assertAppManager_(context);
  const found = findRegisteredAppRecord_(payload && payload.appId);
  if (!found) throw Object.assign(new Error('Aplikasi tidak ditemukan.'), { code: 'NOT_FOUND' });
  const record = Object.assign({}, found.raw, { STATUS: 'ACTIVE', DELETED_AT: '', UPDATED_AT: new Date() });
  writeRegisteredAppRecord_(getPortalSpreadsheet_().getSheetByName('APPS'), found.rowNumber, record);
  writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'apps.restore', status: 'SUCCESS', details: { appId: record.APP_ID } });
  return success_(null, 'Aplikasi berhasil dipulihkan.');
}

function moveRegisteredApp_(context, payload, requestId) {
  assertAppManager_(context);
  const apps = readRegisteredApps_().filter(function(record) { return !record.raw.DELETED_AT; }).sort(function(a,b) { return Number(a.raw.SORT_ORDER || 0) - Number(b.raw.SORT_ORDER || 0); });
  const index = apps.findIndex(function(record) { return String(record.raw.APP_ID) === String(payload.appId); });
  const target = String(payload.direction || '').toUpperCase() === 'UP' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= apps.length) return success_(null, 'Posisi tidak berubah.');
  const left = Number(apps[index].raw.SORT_ORDER || index + 1);
  const right = Number(apps[target].raw.SORT_ORDER || target + 1);
  const sheet = getPortalSpreadsheet_().getSheetByName('APPS');
  const headers = getSheetHeaders_(sheet);
  const sortIndex = headers.indexOf('SORT_ORDER') + 1;
  sheet.getRange(apps[index].rowNumber, sortIndex).setValue(right);
  sheet.getRange(apps[target].rowNumber, sortIndex).setValue(left);
  return success_(null, 'Posisi aplikasi diperbarui.');
}

function openRegisteredSpreadsheet_(appId) {
  const found = findRegisteredAppRecord_(appId);
  if (!found) throw Object.assign(new Error('Aplikasi tidak ditemukan.'), { code: 'NOT_FOUND' });
  const spreadsheetId = String(found.raw.SPREADSHEET_ID || '').trim();
  if (!spreadsheetId) throw Object.assign(new Error('Spreadsheet ID aplikasi belum diisi.'), { code: 'VALIDATION_ERROR' });
  return { record: found, spreadsheet: SpreadsheetApp.openById(spreadsheetId) };
}

function validateRegisteredAppConnection_(context, payload) {
  requirePermission_(context, 'portal.apps.view');
  const opened = openRegisteredSpreadsheet_(payload && payload.appId);
  return success_({ spreadsheetName: opened.spreadsheet.getName(), spreadsheetId: opened.spreadsheet.getId() }, 'Koneksi Spreadsheet berhasil.');
}

function readConfigWebObject_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName || 'CONFIG_WEB');
  if (!sheet) throw Object.assign(new Error('Sheet CONFIG_WEB tidak ditemukan.'), { code: 'NOT_FOUND' });
  const values = sheet.getDataRange().getDisplayValues();
  const config = {};
  for (let i = 1; i < values.length; i += 1) {
    const key = String(values[i][0] || '').trim();
    if (key) config[key] = String(values[i][1] == null ? '' : values[i][1]);
  }
  return config;
}

function syncRegisteredAppConfig_(context, payload, requestId) {
  assertAppManager_(context);
  const opened = openRegisteredSpreadsheet_(payload && payload.appId);
  const configSheet = String(opened.record.raw.CONFIG_SHEET || 'CONFIG_WEB');
  const config = readConfigWebObject_(opened.spreadsheet, configSheet);
  const json = JSON.stringify(config);
  const hash = bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, json, Utilities.Charset.UTF_8));
  const cache = getPortalSpreadsheet_().getSheetByName('APP_CONFIG_CACHE');
  const cacheRecord = {
    APP_ID: String(opened.record.raw.APP_ID), CONFIG_VERSION: String(config.CONFIG_VERSION || config.VERSION || ''), CONFIG_JSON: json,
    CONFIG_HASH: hash, CACHED_AT: new Date(), SOURCE_SPREADSHEET_ID: opened.spreadsheet.getId(), SOURCE_SHEET: configSheet
  };
  upsertRowsByKey_(cache, 'APP_ID', [cacheRecord]);
  const appRecord = Object.assign({}, opened.record.raw, { CONFIG_VERSION: cacheRecord.CONFIG_VERSION, CONFIG_HASH: hash, CONFIG_SYNCED_AT: new Date(), UPDATED_AT: new Date() });
  writeRegisteredAppRecord_(getPortalSpreadsheet_().getSheetByName('APPS'), opened.record.rowNumber, appRecord);
  syncAppRoleMasterFromCache_(getPortalSpreadsheet_());
  syncAppRolePermissionsFromCache_(getPortalSpreadsheet_());
  writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'apps.syncConfig', status: 'SUCCESS', details: { appId: appRecord.APP_ID, hash: hash } });
  return success_({ configHash: hash, configVersion: cacheRecord.CONFIG_VERSION }, 'CONFIG_WEB berhasil disinkronkan tanpa mengubah Spreadsheet aplikasi.');
}

function getRegisteredAppConfig_(context, payload) {
  requirePermission_(context, String(payload && payload.appId || '') + '.access');
  const sheet = getPortalSpreadsheet_().getSheetByName('APP_CONFIG_CACHE');
  if (!sheet || sheet.getLastRow() < 2) return success_({ config: {} }, 'Cache config belum tersedia.');
  const headers = getSheetHeaders_(sheet);
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  for (let i = 0; i < rows.length; i += 1) {
    const item = rowToObject_(headers, rows[i]);
    if (String(item.APP_ID) === String(payload.appId)) {
      let config = {}; try { config = JSON.parse(String(item.CONFIG_JSON || '{}')); } catch (e) {}
      return success_({ config: config, cachedAt: item.CACHED_AT ? new Date(item.CACHED_AT).toISOString() : '' }, 'Config aplikasi berhasil dimuat.');
    }
  }
  return success_({ config: {} }, 'Cache config belum tersedia.');
}
