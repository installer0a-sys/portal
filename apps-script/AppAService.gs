const APP_A_ID_ = 'appA';
const APP_A_DEFAULT_SPREADSHEET_ID_ = '1XF4dJfGiUZI8WEV5iTwdqHABfjSmONgcT-b0KCqryHs';

function getAppAContext_(context) {
  requirePermission_(context, APP_A_ID_ + '.access');
  const opened = openRegisteredSpreadsheet_(APP_A_ID_);
  const config = readConfigWebObject_(opened.spreadsheet, String(opened.record.raw.CONFIG_SHEET || 'CONFIG_WEB'));
  return { spreadsheet: opened.spreadsheet, app: opened.record.raw, config: config };
}

function getAppARoles_(context) {
  const entry = context.access.apps && context.access.apps[APP_A_ID_] || {};
  const roles = Array.isArray(entry.roles) ? entry.roles : (entry.role ? [entry.role] : []);
  return roles.map(normalizeAppRole_).filter(Boolean);
}

function appAResolveScheduleSheet_(appContext, requestedSheet) {
  const ss = appContext.spreadsheet;
  const direct = String(requestedSheet || '').trim();
  if (direct && ss.getSheetByName(direct)) return direct;
  const configured = String(appContext.config.CONF_JADWAL_SHEET || '').trim();
  if (configured && ss.getSheetByName(configured)) return configured;
  const monthNames = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
  const now = new Date();
  const candidate = monthNames[now.getMonth()] + ' ' + now.getFullYear();
  if (ss.getSheetByName(candidate)) return candidate;
  const sheets = ss.getSheets().map(function(sheet) { return sheet.getName(); });
  return sheets.find(function(name) { return /^(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\s+\d{4}$/i.test(name); }) || '';
}

function appAListMonthSheets_(ss) {
  return ss.getSheets().map(function(sheet) { return sheet.getName(); }).filter(function(name) {
    return /^(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\s+\d{4}$/i.test(name);
  }).sort().reverse();
}

function appAScheduleList_(context, payload) {
  const appContext = getAppAContext_(context);
  const sheetName = appAResolveScheduleSheet_(appContext, payload && payload.sheetName);
  if (!sheetName) return success_({ sheetName: '', sheets: appAListMonthSheets_(appContext.spreadsheet), headers: [], rows: [], total: 0 }, 'Sheet jadwal belum ditemukan.');
  const sheet = appContext.spreadsheet.getSheetByName(sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.length ? values[0] : [];
  const maxRows = Math.max(1, Math.min(1000, Number(payload && payload.limit || 300)));
  const rows = values.slice(1, maxRows + 1).filter(function(row) { return row.some(function(value) { return String(value || '').trim() !== ''; }); });
  writeAuditLog_({ requestId: payload && payload.requestId || '', userId: context.user.USER_ID, action: 'appA.schedule.view', status: 'SUCCESS', details: { sheetName: sheetName, rows: rows.length } });
  return success_({
    appName: 'Jadwal A542', sheetName: sheetName, sheets: appAListMonthSheets_(appContext.spreadsheet), headers: headers, rows: rows,
    total: rows.length, roles: getAppARoles_(context), readOnly: getAppARoles_(context).indexOf('USER') >= 0 && getAppARoles_(context).length === 1
  }, 'Data Jadwal A542 berhasil dimuat.');
}

function appADashboard_(context, payload) {
  const result = appAScheduleList_(context, Object.assign({}, payload || {}, { limit: 500 }));
  const data = result.data || {};
  const headers = data.headers || [];
  const rows = data.rows || [];
  const zoneIndex = headers.findIndex(function(header) { return /zona|departemen|department/i.test(String(header)); });
  const summary = {};
  rows.forEach(function(row) {
    const key = zoneIndex >= 0 ? String(row[zoneIndex] || 'Tanpa Zona') : 'Semua';
    summary[key] = (summary[key] || 0) + 1;
  });
  return success_({ sheetName: data.sheetName, totalEmployees: rows.length, summary: summary, roles: data.roles, readOnly: data.readOnly }, 'Dashboard Jadwal A542 berhasil dimuat.');
}

function appARequireAdmin_(context) {
  const roles = getAppARoles_(context);
  if (roles.indexOf('ADMIN') < 0) {
    throw Object.assign(new Error('Hanya Admin App Jadwal A542 yang dapat mengubah pengaturan.'), { code: 'FORBIDDEN' });
  }
}

function appAGetSheetHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function(value) {
    return String(value || '').trim();
  });
}

function appAConfiguration_(context) {
  const appContext = getAppAContext_(context);
  const sheets = appContext.spreadsheet.getSheets();
  const headers = {};
  sheets.forEach(function(sheet) { headers[sheet.getName()] = appAGetSheetHeaders_(sheet); });
  const keys = [
    'CONF_JADWAL_SHEET','CONF_JADWAL_REFRESH','CONF_LIBUR_TGL_MERAH','CONF_LIBUR_MAX','CONF_LIBUR_MAX_VM',
    'CONF_DASHBOARD_SHEET','CONF_DASH_ZONA_SHEET','CONF_DASH_ZONA_HEADER','CONF_DASH_NAMA_HEADER',
    'CONF_ROSTER_SHEET','CONF_ROSTER_DROP','CONF_ROSTER_DISP','CONF_ROSTER_CODE','CONF_ROSTER_TOTAL',
    'CONF_KAR_SHEET','CONF_KAR_NIP','CONF_KAR_NAMA','CONF_KAR_DEPT','CONF_KAR_ZONA','CONF_KAR_JABATAN','CONF_KAR_JAB_DASH','CONF_KAR_RO',
    'CONF_SPV_SHEET','CONF_SPV_HEADER','CONF_SPV_ROLES','CONF_DOP_SHEET','CONF_DOP_HEADER','CONF_DOP_ROLES',
    'CONF_EDIT_ALL_LOCK','CONF_EDIT_SPV_LOCK','CONF_EXCLUDE_LAMA','URUTAN_ZONA'
  ];
  const config = {};
  keys.forEach(function(key) { config[key] = String(appContext.config[key] || ''); });
  return success_({
    config: config,
    sheets: sheets.map(function(sheet) { return sheet.getName(); }),
    headers: headers,
    spreadsheetName: appContext.spreadsheet.getName()
  }, 'Konfigurasi Jadwal A542 berhasil dimuat.');
}

function appAWriteConfigValues_(spreadsheet, sheetName, updates) {
  let sheet = spreadsheet.getSheetByName(sheetName || 'CONFIG_WEB');
  if (!sheet) throw Object.assign(new Error('Sheet CONFIG_WEB tidak ditemukan.'), { code: 'NOT_FOUND' });
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  const rowByKey = {};
  for (let i = 1; i < values.length; i += 1) {
    const key = String(values[i][0] || '').trim();
    if (key) rowByKey[key] = i + 1;
  }
  const appendRows = [];
  Object.keys(updates).forEach(function(key) {
    const value = updates[key] == null ? '' : String(updates[key]);
    if (rowByKey[key]) sheet.getRange(rowByKey[key], 2).setNumberFormat('@').setValue(value);
    else appendRows.push([key, value]);
  });
  if (appendRows.length) {
    const start = Math.max(2, sheet.getLastRow() + 1);
    sheet.getRange(start, 1, appendRows.length, 2).setNumberFormat('@').setValues(appendRows);
  }
}

function appASaveConfiguration_(context, payload, requestId) {
  appARequireAdmin_(context);
  const appContext = getAppAContext_(context);
  const allowed = [
    'CONF_JADWAL_SHEET','CONF_JADWAL_REFRESH','CONF_LIBUR_TGL_MERAH','CONF_LIBUR_MAX','CONF_LIBUR_MAX_VM',
    'CONF_DASHBOARD_SHEET','CONF_DASH_ZONA_SHEET','CONF_DASH_ZONA_HEADER','CONF_DASH_NAMA_HEADER',
    'CONF_ROSTER_SHEET','CONF_ROSTER_DROP','CONF_ROSTER_DISP','CONF_ROSTER_CODE','CONF_ROSTER_TOTAL',
    'CONF_KAR_SHEET','CONF_KAR_NIP','CONF_KAR_NAMA','CONF_KAR_DEPT','CONF_KAR_ZONA','CONF_KAR_JABATAN','CONF_KAR_JAB_DASH','CONF_KAR_RO',
    'CONF_SPV_SHEET','CONF_SPV_HEADER','CONF_SPV_ROLES','CONF_DOP_SHEET','CONF_DOP_HEADER','CONF_DOP_ROLES',
    'CONF_EDIT_ALL_LOCK','CONF_EDIT_SPV_LOCK','CONF_EXCLUDE_LAMA','URUTAN_ZONA'
  ];
  const input = payload && payload.config || {};
  const updates = {};
  allowed.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(input, key)) updates[key] = input[key];
  });
  appAWriteConfigValues_(appContext.spreadsheet, String(appContext.app.CONFIG_SHEET || 'CONFIG_WEB'), updates);
  writeAuditLog_({ requestId: requestId || '', userId: context.user.USER_ID, action: 'appA.config.update', status: 'SUCCESS', details: { keys: Object.keys(updates) } });
  return success_({ updated: Object.keys(updates) }, 'Pengaturan Jadwal A542 berhasil disimpan tanpa mengganti data CONFIG_WEB lainnya.');
}

function appAEmployees_(context, payload) {
  const appContext = getAppAContext_(context);
  const config = appContext.config;
  const requested = String(payload && payload.sheetName || '').trim();
  const sheetName = requested || String(config.CONF_KAR_SHEET || '').trim();
  if (!sheetName) return success_({ sheetName: '', headers: [], rows: [], total: 0, mapping: {} }, 'Sheet Data Karyawan belum dikonfigurasi.');
  const sheet = appContext.spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw Object.assign(new Error('Sheet Data Karyawan tidak ditemukan: ' + sheetName), { code: 'NOT_FOUND' });
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.length ? values[0].map(function(value) { return String(value || '').trim(); }) : [];
  const query = String(payload && payload.query || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(1000, Number(payload && payload.limit || 500)));
  const rows = values.slice(1).filter(function(row) {
    if (!row.some(function(value) { return String(value || '').trim() !== ''; })) return false;
    return !query || row.some(function(value) { return String(value || '').toLowerCase().indexOf(query) >= 0; });
  }).slice(0, limit);
  const mapping = {
    nip: String(config.CONF_KAR_NIP || ''), name: String(config.CONF_KAR_NAMA || ''), department: String(config.CONF_KAR_DEPT || ''),
    zone: String(config.CONF_KAR_ZONA || ''), position: String(config.CONF_KAR_JABATAN || ''), dashboardPosition: String(config.CONF_KAR_JAB_DASH || ''), ro: String(config.CONF_KAR_RO || '')
  };
  writeAuditLog_({ requestId: payload && payload.requestId || '', userId: context.user.USER_ID, action: 'appA.employees.view', status: 'SUCCESS', details: { sheetName: sheetName, rows: rows.length } });
  return success_({ sheetName: sheetName, headers: headers, rows: rows, total: rows.length, mapping: mapping, readOnly: getAppARoles_(context).indexOf('ADMIN') < 0 }, 'Data Karyawan berhasil dimuat.');
}
