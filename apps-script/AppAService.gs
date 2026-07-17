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
