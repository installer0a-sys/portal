function appAColumnUniqueValuesV062_(sheet, headerName) {
  if (!sheet || !headerName || sheet.getLastRow() < 2) return [];
  const headers = appAGetSheetHeaders_(sheet);
  const normalized = headers.map(appANormalizeText_);
  const index = normalized.indexOf(appANormalizeText_(headerName));
  if (index < 0) return [];
  const values = sheet.getRange(2, index + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  const found = {};
  values.forEach(function(row) {
    String(row[0] || '').split(',').forEach(function(part) {
      const value = String(part || '').trim();
      if (value) found[appANormalizeText_(value)] = value;
    });
  });
  return Object.keys(found).sort().map(function(key) { return found[key]; });
}

function appAConfigurationV062_(context) {
  const base = appAConfiguration_(context);
  const data = base.data || {};
  const appContext = getAppAContext_(context);
  const roleOptions = {};
  Object.keys(data.headers || {}).forEach(function(sheetName) {
    const sheet = appContext.spreadsheet.getSheetByName(sheetName);
    roleOptions[sheetName] = {};
    (data.headers[sheetName] || []).forEach(function(headerName) {
      roleOptions[sheetName][headerName] = appAColumnUniqueValuesV062_(sheet, headerName);
    });
  });
  data.roleOptions = roleOptions;
  return success_(data, 'Konfigurasi Jadwal A542 dan seluruh opsi filter berhasil dimuat.');
}

function appASaveEmployeesV062_(context, payload, requestId) {
  appARequireAdmin_(context);
  const appContext = getAppAContext_(context);
  const sheetName = String(payload && payload.sheetName || appContext.config.CONF_KAR_SHEET || '').trim();
  if (!sheetName) throw Object.assign(new Error('Sheet Data Karyawan belum dipilih.'), { code: 'VALIDATION_ERROR' });
  const sheet = appContext.spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw Object.assign(new Error('Sheet Data Karyawan tidak ditemukan: ' + sheetName), { code: 'NOT_FOUND' });
  const currentHeaders = appAGetSheetHeaders_(sheet);
  const headers = Array.isArray(payload && payload.headers) ? payload.headers.map(String) : [];
  if (!headers.length || JSON.stringify(headers) !== JSON.stringify(currentHeaders)) {
    throw Object.assign(new Error('Header Data Karyawan berubah. Refresh halaman sebelum menyimpan.'), { code: 'CONFLICT' });
  }
  const inputRows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  if (inputRows.length > 3000) throw Object.assign(new Error('Maksimal 3000 baris per penyimpanan.'), { code: 'VALIDATION_ERROR' });
  const rows = inputRows.map(function(row) {
    if (!Array.isArray(row)) return new Array(headers.length).fill('');
    return headers.map(function(_, index) { return row[index] == null ? '' : String(row[index]); });
  }).filter(function(row) { return row.some(function(value) { return String(value).trim() !== ''; }); });
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw Object.assign(new Error('Data sedang diedit pengguna lain.'), { code: 'CONFLICT' });
  try {
    const oldLastRow = sheet.getLastRow();
    if (oldLastRow > 1) sheet.getRange(2, 1, oldLastRow - 1, Math.max(headers.length, sheet.getLastColumn())).clearContent();
    if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setNumberFormat('@').setValues(rows);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  writeAuditLog_({ requestId: requestId || '', userId: context.user.USER_ID, action: 'appA.employees.saveAll', status: 'SUCCESS', details: { sheetName: sheetName, rows: rows.length } });
  return success_({ sheetName: sheetName, total: rows.length }, rows.length + ' data karyawan berhasil disimpan dan diurutkan ulang.');
}
