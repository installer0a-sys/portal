function syncRegisteredAppConfig_(context, payload, requestId) {
  requirePermission_(context, 'portal.apps.manage');
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);
  const found = findAppRegistryRecord_(appId);
  if (!found || found.data.DELETED_AT) throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi tidak ditemukan.');

  const source = openAppSource_(found.data);
  const configSheetName = String(found.data.CONFIG_SHEET || 'CONFIG_WEB');
  const configSheet = source.getSheetByName(configSheetName);
  if (!configSheet) throwAppRegistryError_('CONFIG_SHEET_NOT_FOUND', 'Sheet ' + configSheetName + ' tidak ditemukan pada Spreadsheet aplikasi.');

  const config = readConfigWebSheet_(configSheet);
  const configJson = JSON.stringify(config);
  const configHash = createTextHash_(configJson);
  const configVersion = String(config.CONF_CONFIG_VERSION || config.CONF_VERSION || configHash.slice(0, 12));
  const syncedAt = new Date();

  upsertAppConfigCache_({
    APP_ID: appId,
    CONFIG_VERSION: configVersion,
    CONFIG_JSON: configJson,
    CONFIG_HASH: configHash,
    CACHED_AT: syncedAt,
    SOURCE_SPREADSHEET_ID: source.getId(),
    SOURCE_SHEET: configSheetName
  });

  const updated = Object.assign({}, found.data, {
    CONFIG_VERSION: configVersion,
    CONFIG_HASH: configHash,
    CONFIG_SYNCED_AT: syncedAt,
    UPDATED_AT: syncedAt
  });
  writeAppRegistryRow_(found.rowNumber, updated);
  clearAppConfigRuntimeCache_(appId);
  writeAppRegistryAudit_(context, requestId, 'app.config.sync', appId, {
    configSheet: configSheetName,
    itemCount: Object.keys(config).length,
    configHash: configHash
  });

  return success_({
    app: sanitizeAppRecord_(updated),
    config: config,
    itemCount: Object.keys(config).length
  }, 'CONFIG_WEB berhasil disinkronkan tanpa mengubah Spreadsheet aplikasi.');
}

function getRegisteredAppConfig_(context, payload) {
  const input = requireObject_(payload || {}, 'payload');
  const appId = requireAppId_(input.appId);
  requirePermission_(context, appId + '.access');
  const found = findAppRegistryRecord_(appId);
  if (!found || found.data.DELETED_AT || normalizeAppStatus_(found.data) !== 'ACTIVE') {
    throwAppRegistryError_('APP_NOT_FOUND', 'Aplikasi tidak aktif atau tidak ditemukan.');
  }

  const runtimeKey = appConfigRuntimeCacheKey_(appId, found.data.CONFIG_HASH);
  const runtimeCache = CacheService.getScriptCache();
  const cachedRuntime = runtimeCache.get(runtimeKey);
  if (cachedRuntime) {
    return success_({ appId: appId, config: JSON.parse(cachedRuntime), source: 'runtime-cache' }, 'Konfigurasi aplikasi dimuat.');
  }

  const cached = findAppConfigCache_(appId);
  if (!cached) {
    throwAppRegistryError_('CONFIG_NOT_SYNCED', 'Konfigurasi aplikasi belum disinkronkan oleh admin.');
  }
  const config = JSON.parse(String(cached.data.CONFIG_JSON || '{}'));
  const ttl = Math.max(60, Math.min(Number(found.data.CACHE_TTL_SECONDS || 900), 21600));
  runtimeCache.put(runtimeKey, JSON.stringify(config), ttl);
  return success_({ appId: appId, config: config, source: 'portal-cache' }, 'Konfigurasi aplikasi dimuat.');
}

function readConfigWebSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 2) return {};
  const values = sheet.getRange(1, 1, lastRow, Math.max(2, lastColumn)).getDisplayValues();
  let startIndex = 0;
  const firstKey = String(values[0][0] || '').trim().toUpperCase();
  if (['KEY', 'CONFIG_KEY', 'NAMA', 'PARAMETER'].indexOf(firstKey) >= 0) startIndex = 1;
  const output = {};
  for (let index = startIndex; index < values.length; index += 1) {
    const key = String(values[index][0] || '').trim();
    if (!key) continue;
    output[key] = parseConfigValue_(values[index][1]);
  }
  return output;
}

function parseConfigValue_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  if ((text.charAt(0) === '{' && text.charAt(text.length - 1) === '}') ||
      (text.charAt(0) === '[' && text.charAt(text.length - 1) === ']')) {
    try { return JSON.parse(text); } catch (ignored) {}
  }
  const upper = text.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return text;
}

function upsertAppConfigCache_(record) {
  const sheet = getPortalSpreadsheet_().getSheetByName('APP_CONFIG_CACHE');
  if (!sheet) throwAppRegistryError_('REGISTRY_NOT_READY', 'Cache konfigurasi belum tersedia. Jalankan setupPortalSheets().');
  const headers = getSheetHeaders_(sheet);
  const found = findAppConfigCache_(record.APP_ID);
  const row = headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; });
  if (found) sheet.getRange(found.rowNumber, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function findAppConfigCache_(appId) {
  const sheet = getPortalSpreadsheet_().getSheetByName('APP_CONFIG_CACHE');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const headers = getSheetHeaders_(sheet);
  const idIndex = headers.indexOf('APP_ID');
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index][idIndex]) === String(appId)) return { rowNumber: index + 2, data: rowToObject_(headers, rows[index]) };
  }
  return null;
}

function createTextHash_(text) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''), Utilities.Charset.UTF_8));
}

function appConfigRuntimeCacheKey_(appId, hash) {
  return 'app-config:' + String(appId) + ':' + String(hash || 'none').slice(0, 20);
}

function clearAppConfigRuntimeCache_(appId) {
  const found = findAppRegistryRecord_(appId);
  if (!found) return;
  CacheService.getScriptCache().remove(appConfigRuntimeCacheKey_(appId, found.data.CONFIG_HASH));
}
