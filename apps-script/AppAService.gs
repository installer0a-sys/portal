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

function appAReadScheduleData_(appContext, requestedSheet, limit) {
  const sheetName = appAResolveScheduleSheet_(appContext, requestedSheet);
  const monthSheets = appAListMonthSheets_(appContext.spreadsheet);
  if (!sheetName) return { sheetName: '', sheets: monthSheets, head1: [], head2: [], rows: [], total: 0 };
  const sheet = appContext.spreadsheet.getSheetByName(sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  const head1 = values.length ? values[0].map(function(value) { return String(value || '').trim(); }) : [];
  const possibleHead2 = values.length > 1 ? values[1].map(function(value) { return String(value || '').trim(); }) : [];
  const weekdayTokens = ['MG','SN','SL','RB','KM','JM','SB'];
  const looksLikeSecondHeader = possibleHead2.some(function(value) { return weekdayTokens.indexOf(String(value || '').toUpperCase()) >= 0; });
  const head2 = looksLikeSecondHeader ? possibleHead2 : new Array(head1.length).fill('');
  const dataStart = looksLikeSecondHeader ? 2 : 1;
  const maxRows = Math.max(1, Math.min(2000, Number(limit || 1000)));
  const rows = values.slice(dataStart, dataStart + maxRows).filter(function(row) {
    return row.some(function(value) { return String(value || '').trim() !== ''; });
  });
  return { sheetName: sheetName, sheets: monthSheets, head1: head1, head2: head2, rows: rows, total: rows.length };
}

function appAFindHeaderIndex_(headers, patterns, fallback) {
  for (let i = 0; i < headers.length; i += 1) {
    const normalized = String(headers[i] || '').trim().toUpperCase();
    if (patterns.some(function(pattern) { return normalized.indexOf(pattern) >= 0; })) return i;
  }
  return fallback;
}

function appAGroupScheduleRows_(data, config) {
  const headers = data.head1 || [];
  const zoneIndex = appAFindHeaderIndex_(headers, ['ZONA'], 3);
  const departmentIndex = appAFindHeaderIndex_(headers, ['DEPARTEMEN','DEPARTMENT'], 2);
  const groups = {};
  data.rows.forEach(function(row) {
    const zone = String(row[zoneIndex] || row[departmentIndex] || 'TANPA ZONA').trim() || 'TANPA ZONA';
    if (!groups[zone]) groups[zone] = [];
    groups[zone].push(row);
  });
  const configuredOrder = String(config.URUTAN_ZONA || '').split(/[,;\n]/).map(function(value) { return value.trim(); }).filter(Boolean);
  const zones = Object.keys(groups).sort(function(a, b) {
    const ai = configuredOrder.map(function(value){ return value.toUpperCase(); }).indexOf(a.toUpperCase());
    const bi = configuredOrder.map(function(value){ return value.toUpperCase(); }).indexOf(b.toUpperCase());
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  return { zones: zones, groups: groups, zoneIndex: zoneIndex, departmentIndex: departmentIndex };
}

function appAScheduleList_(context, payload) {
  const appContext = getAppAContext_(context);
  const data = appAReadScheduleData_(appContext, payload && payload.sheetName, payload && payload.limit);
  const grouped = appAGroupScheduleRows_(data, appContext.config);
  writeAuditLog_({ requestId: payload && payload.requestId || '', userId: context.user.USER_ID, action: 'appA.schedule.view', status: 'SUCCESS', details: { sheetName: data.sheetName, rows: data.rows.length } });
  return success_({
    appName: 'Jadwal A542', sheetName: data.sheetName, sheets: data.sheets,
    head1: data.head1, head2: data.head2, headers: data.head1, rows: data.rows,
    zones: grouped.zones, groupedRows: grouped.groups, total: data.total,
    roles: getAppARoles_(context), readOnly: getAppARoles_(context).indexOf('USER') >= 0 && getAppARoles_(context).length === 1
  }, 'Data Jadwal A542 berhasil dimuat.');
}

function appADashboard_(context, payload) {
  const appContext = getAppAContext_(context);
  const data = appAReadScheduleData_(appContext, payload && payload.sheetName, 1500);
  const grouped = appAGroupScheduleRows_(data, appContext.config);
  const offset = Math.max(0, Math.min(2, Number(payload && payload.dayOffset || 0)));
  const now = new Date();
  now.setDate(now.getDate() + offset);
  const targetDay = String(now.getDate());
  let dayIndex = -1;
  for (let i = 0; i < data.head1.length; i += 1) {
    if (String(data.head1[i] || '').trim() === targetDay) { dayIndex = i; break; }
  }
  const nipIndex = appAFindHeaderIndex_(data.head1, ['NIP'], 0);
  const nameIndex = appAFindHeaderIndex_(data.head1, ['NAMA'], 1);
  const deptIndex = appAFindHeaderIndex_(data.head1, ['DEPARTEMEN','DEPARTMENT'], 2);
  const zoneIndex = appAFindHeaderIndex_(data.head1, ['ZONA'], 3);
  const positionIndex = appAFindHeaderIndex_(data.head1, ['JABATAN'], 4);
  const rows = data.rows.map(function(row) {
    return {
      nip: String(row[nipIndex] || ''), name: String(row[nameIndex] || ''), department: String(row[deptIndex] || ''),
      zone: String(row[zoneIndex] || row[deptIndex] || 'TANPA ZONA'), position: String(row[positionIndex] || ''),
      roster: dayIndex >= 0 ? String(row[dayIndex] || '') : '', raw: row
    };
  });
  const dashboardGroups = {};
  rows.forEach(function(item) {
    const zone = item.zone || 'TANPA ZONA';
    if (!dashboardGroups[zone]) dashboardGroups[zone] = [];
    dashboardGroups[zone].push(item);
  });
  return success_({
    sheetName: data.sheetName, sheets: data.sheets, dateLabel: Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd MMMM yyyy'),
    dayOffset: offset, dayIndex: dayIndex, zones: grouped.zones, groups: dashboardGroups,
    totalEmployees: rows.length, roles: getAppARoles_(context)
  }, 'Dashboard Jadwal A542 berhasil dimuat.');
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
