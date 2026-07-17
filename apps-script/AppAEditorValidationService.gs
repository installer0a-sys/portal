function appAEditorLockState_(appContext, view) {
  const config = appContext.config || {};
  const key = view === 'jadwal-spv' ? 'CONF_EDIT_SPV_LOCK' : 'CONF_EDIT_ALL_LOCK';
  const raw = String(config[key] || '').trim().toUpperCase();
  const locked = ['1','TRUE','YES','YA','LOCK','LOCKED','AKTIF'].indexOf(raw) >= 0;
  return {
    key: key,
    value: raw,
    locked: locked,
    message: locked ? 'Periode editor sedang dikunci oleh Administrator.' : ''
  };
}

function appAEditorHolidayMap_(appContext) {
  const config = appContext.config || {};
  const sheetName = String(config.CONF_LIBUR_TGL_MERAH || '').trim();
  if (!sheetName) return {};

  const sheet = appContext.spreadsheet.getSheetByName(sheetName);
  if (!sheet) return {};

  const values = sheet.getDataRange().getDisplayValues();
  const map = {};
  values.slice(1).forEach(function(row) {
    const dateText = String(row[0] || '').trim();
    const label = String(row[1] || 'Hari Libur').trim();
    if (dateText) map[dateText] = label;
  });
  return map;
}

function appAEditorBuildValidation_(appContext, editor) {
  const rosterOptions = appAEditorRosterOptions_(appContext);
  const allowedValues = {};
  rosterOptions.forEach(function(option) {
    allowedValues[appANormalizeText_(option.value)] = true;
  });
  ['', '-', 'OFF', 'O', 'RO', 'AL', 'P', 'X', 'M'].forEach(function(value) {
    allowedValues[appANormalizeText_(value)] = true;
  });

  return {
    rosterOptions: rosterOptions,
    allowedValues: allowedValues,
    holidayMap: appAEditorHolidayMap_(appContext),
    dateColumns: editor.dateColumns || []
  };
}

function appAEditorValidateChanges_(appContext, editor, changes) {
  const validation = appAEditorBuildValidation_(appContext, editor);
  const allowedRows = {};
  const allowedColumns = {};
  const columnByIndex = {};

  editor.rows.forEach(function(row) {
    allowedRows[String(row.rowIndex)] = row;
  });

  validation.dateColumns.forEach(function(column) {
    allowedColumns[String(column.index)] = true;
    columnByIndex[String(column.index)] = column;
  });

  const normalized = [];
  const warnings = [];
  const blocked = [];

  (changes || []).forEach(function(change) {
    const rowIndex = Number(change && change.rowIndex);
    const columnIndex = Number(change && change.columnIndex);
    const value = String(change && change.value == null ? '' : change.value).trim();
    const originalValue = String(change && change.originalValue == null ? '' : change.originalValue).trim();
    const row = allowedRows[String(rowIndex)];
    const column = columnByIndex[String(columnIndex)];

    if (!Number.isInteger(rowIndex) || !row) {
      blocked.push({ rowIndex: rowIndex, columnIndex: columnIndex, message: 'Baris di luar scope akses.' });
      return;
    }

    if (!Number.isInteger(columnIndex) || !allowedColumns[String(columnIndex)]) {
      blocked.push({ rowIndex: rowIndex, columnIndex: columnIndex, message: 'Kolom bukan kolom tanggal.' });
      return;
    }

    if (!validation.allowedValues[appANormalizeText_(value)]) {
      blocked.push({ rowIndex: rowIndex, columnIndex: columnIndex, message: 'Kode roster tidak terdaftar: ' + value });
      return;
    }

    const holidayLabel = validation.holidayMap[String(column.day || '')];
    if (holidayLabel && !['OFF','O','RO','AL',''].includes(appANormalizeText_(value))) {
      warnings.push({
        rowIndex: rowIndex,
        columnIndex: columnIndex,
        nip: row.nip,
        message: 'Tanggal ' + column.day + ' adalah ' + holidayLabel + '.'
      });
    }

    normalized.push({
      rowIndex: rowIndex,
      columnIndex: columnIndex,
      value: value,
      originalValue: originalValue,
      nip: row.nip,
      zone: row.zone,
      day: column.day,
      weekday: column.weekday || ''
    });
  });

  return {
    changes: normalized,
    warnings: warnings,
    blocked: blocked
  };
}

function appAEditorChangeHash_(changes) {
  const raw = JSON.stringify(changes || []);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(function(byte) {
    const value = (byte + 256) % 256;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function appAScheduleEditorValidate_(context, payload) {
  const appContext = getAppAContext_(context);
  const view = String(payload && payload.view || 'jadwal-all').trim();
  const requested = appAResolveViewSheet_(appContext, view, payload && payload.sheetName);
  const sheetName = appAResolveScheduleSheet_(appContext, requested);
  const editor = appAEditorRows_(appContext, context, sheetName, view);
  const lockState = appAEditorLockState_(appContext, view);

  if (lockState.locked) {
    return success_({
      locked: true,
      lockState: lockState,
      warnings: [],
      blocked: [{ message: lockState.message }],
      summary: { cells: 0, employees: 0, dates: [], zones: [] }
    }, lockState.message);
  }

  const validation = appAEditorValidateChanges_(appContext, editor, payload && payload.changes || []);
  const employeeMap = {};
  const dateMap = {};
  const zoneMap = {};

  validation.changes.forEach(function(change) {
    employeeMap[change.nip || String(change.rowIndex)] = true;
    dateMap[change.day || String(change.columnIndex)] = true;
    zoneMap[change.zone || 'TANPA ZONA'] = true;
  });

  return success_({
    locked: false,
    lockState: lockState,
    warnings: validation.warnings,
    blocked: validation.blocked,
    summary: {
      cells: validation.changes.length,
      employees: Object.keys(employeeMap).length,
      dates: Object.keys(dateMap),
      zones: Object.keys(zoneMap)
    },
    changeHash: appAEditorChangeHash_(validation.changes)
  }, validation.blocked.length ? 'Masih ada perubahan yang tidak valid.' : 'Validasi perubahan selesai.');
}

function appAScheduleEditorSaveV059_(context, payload, requestId) {
  const appContext = getAppAContext_(context);
  const view = String(payload && payload.view || 'jadwal-all').trim();
  const requested = appAResolveViewSheet_(appContext, view, payload && payload.sheetName);
  const sheetName = appAResolveScheduleSheet_(appContext, requested);
  const editor = appAEditorRows_(appContext, context, sheetName, view);
  const lockState = appAEditorLockState_(appContext, view);

  if (lockState.locked) {
    throw Object.assign(new Error(lockState.message), { code: 'FORBIDDEN' });
  }

  const validation = appAEditorValidateChanges_(appContext, editor, payload && payload.changes || []);
  if (validation.blocked.length) {
    throw Object.assign(new Error(validation.blocked[0].message), { code: 'VALIDATION_ERROR' });
  }

  const normalized = validation.changes;
  if (!normalized.length) {
    return success_({ updated: 0, sheetName: sheetName }, 'Tidak ada perubahan untuk disimpan.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw Object.assign(new Error('Data sedang disimpan pengguna lain.'), { code: 'CONFLICT' });
  }

  const before = [];
  const after = [];

  try {
    normalized.forEach(function(change) {
      const cell = editor.sheet.getRange(change.rowIndex, change.columnIndex + 1);
      const current = String(cell.getDisplayValue() || '').trim();

      if (current !== change.originalValue) {
        throw Object.assign(new Error(
          'Data berubah sejak editor dibuka pada NIP ' + change.nip + '. Refresh editor lalu ulangi.'
        ), { code: 'CONFLICT' });
      }

      before.push({
        rowIndex: change.rowIndex,
        columnIndex: change.columnIndex,
        value: current,
        nip: change.nip,
        zone: change.zone,
        day: change.day
      });
    });

    normalized.forEach(function(change) {
      editor.sheet.getRange(change.rowIndex, change.columnIndex + 1).setValue(change.value);
      after.push({
        rowIndex: change.rowIndex,
        columnIndex: change.columnIndex,
        value: change.value,
        nip: change.nip,
        zone: change.zone,
        day: change.day
      });
    });

    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  const employeeMap = {};
  const dateMap = {};
  const zoneMap = {};

  after.forEach(function(change) {
    employeeMap[change.nip || String(change.rowIndex)] = true;
    dateMap[change.day || String(change.columnIndex)] = true;
    zoneMap[change.zone || 'TANPA ZONA'] = true;
  });

  writeAuditLog_({
    requestId: requestId || '',
    userId: context.user.USER_ID,
    action: 'appA.schedule.batch.update',
    status: 'SUCCESS',
    details: {
      version: '0.5.9',
      view: view,
      sheetName: sheetName,
      count: after.length,
      employees: Object.keys(employeeMap),
      dates: Object.keys(dateMap),
      zones: Object.keys(zoneMap),
      warnings: validation.warnings,
      changeHash: appAEditorChangeHash_(after),
      before: before,
      after: after
    }
  });

  return success_({
    updated: after.length,
    sheetName: sheetName,
    warnings: validation.warnings,
    changeHash: appAEditorChangeHash_(after)
  }, after.length + ' perubahan jadwal berhasil disimpan.');
}
