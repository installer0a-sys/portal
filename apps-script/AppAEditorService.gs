const APP_A_EDITOR_MAX_CHANGES_ = 1000;

function appAEditorRosterOptions_(appContext) {
  const config = appContext.config || {};
  const sheetName = String(config.CONF_ROSTER_SHEET || '').trim();
  if (!sheetName) return [];
  const sheet = appContext.spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function(value) { return String(value || '').trim(); });

  function resolveIndex(configKey, patterns, fallback) {
    const configured = String(config[configKey] || '').trim();
    if (configured) {
      const normalized = headers.map(appANormalizeText_);
      const exact = normalized.indexOf(appANormalizeText_(configured));
      if (exact >= 0) return exact;
    }
    return appAFindHeaderIndex_(headers, patterns, fallback);
  }

  const codeIndex = resolveIndex('CONF_ROSTER_CODE', ['CODE', 'KODE', 'ROSTER'], 0);
  const displayIndex = resolveIndex('CONF_ROSTER_DISP', ['DISPLAY', 'NAMA', 'KETERANGAN'], codeIndex);
  const seen = {};
  const options = [];

  values.slice(1).forEach(function(row) {
    const value = String(row[codeIndex] || '').trim();
    if (!value || seen[appANormalizeText_(value)]) return;
    seen[appANormalizeText_(value)] = true;
    options.push({
      value: value,
      label: String(row[displayIndex] || value).trim() || value
    });
  });

  return options;
}

function appAEditorDateColumns_(head1, head2) {
  const columns = [];
  for (let index = 0; index < head1.length; index += 1) {
    const first = String(head1[index] || '').trim();
    const second = String(head2[index] || '').trim();
    if (/^\d{1,2}$/.test(first)) {
      columns.push({
        index: index,
        day: first,
        weekday: second
      });
    }
  }
  return columns;
}

function appAEditorRows_(appContext, context, sheetName, view) {
  const sheet = appContext.spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw Object.assign(new Error('Sheet jadwal tidak ditemukan: ' + sheetName), { code: 'NOT_FOUND' });

  const values = sheet.getDataRange().getDisplayValues();
  const head1 = values.length ? values[0].map(function(value) { return String(value || '').trim(); }) : [];
  const possibleHead2 = values.length > 1 ? values[1].map(function(value) { return String(value || '').trim(); }) : [];
  const weekdayTokens = ['MG','SN','SL','RB','KM','JM','SB'];
  const hasSecondHeader = possibleHead2.some(function(value) {
    return weekdayTokens.indexOf(appANormalizeText_(value)) >= 0;
  });
  const head2 = hasSecondHeader ? possibleHead2 : new Array(head1.length).fill('');
  const startRow = hasSecondHeader ? 3 : 2;

  const scope = appAViewScope_(context, appContext, view);
  if (scope.readOnly) {
    throw Object.assign(new Error('Role USER hanya memiliki akses baca.'), { code: 'FORBIDDEN' });
  }

  const nipIndex = appAFindHeaderIndex_(head1, ['NIP'], 0);
  const zoneIndex = appAFindHeaderIndex_(head1, ['ZONA'], 3);
  const nameIndex = appAFindHeaderIndex_(head1, ['NAMA'], 1);
  const departmentIndex = appAFindHeaderIndex_(head1, ['DEPARTEMEN','DEPARTMENT'], 2);

  const targetNip = appANormalizeText_(scope.identity && scope.identity.nip);
  const targetZone = appANormalizeText_(scope.identity && scope.identity.zone);
  const rows = [];

  values.slice(startRow - 1).forEach(function(row, offset) {
    if (!row.some(function(value) { return String(value || '').trim() !== ''; })) return;

    let allowed = true;
    if (scope.mode === 'OWN_NIP') {
      allowed = Boolean(targetNip) && appANormalizeText_(row[nipIndex]) === targetNip;
    } else if (scope.mode === 'OWN_ZONE') {
      allowed = Boolean(targetZone) && appANormalizeText_(row[zoneIndex]) === targetZone;
    }
    if (!allowed) return;

    rows.push({
      rowIndex: startRow + offset,
      nip: String(row[nipIndex] || '').trim(),
      name: String(row[nameIndex] || '').trim(),
      department: String(row[departmentIndex] || '').trim(),
      zone: String(row[zoneIndex] || '').trim(),
      values: row
    });
  });

  return {
    sheet: sheet,
    head1: head1,
    head2: head2,
    rows: rows,
    scope: scope,
    dateColumns: appAEditorDateColumns_(head1, head2)
  };
}

function appAScheduleEditorGet_(context, payload) {
  const appContext = getAppAContext_(context);
  const view = String(payload && payload.view || 'jadwal-all').trim();
  if (['jadwal-all', 'jadwal-spv'].indexOf(view) < 0) {
    throw Object.assign(new Error('Editor hanya tersedia untuk Jadwal All dan Jadwal SPV.'), { code: 'VALIDATION_ERROR' });
  }

  const requested = appAResolveViewSheet_(appContext, view, payload && payload.sheetName);
  const sheetName = appAResolveScheduleSheet_(appContext, requested);
  const editor = appAEditorRows_(appContext, context, sheetName, view);
  const options = appAEditorRosterOptions_(appContext);

  writeAuditLog_({
    requestId: payload && payload.requestId || '',
    userId: context.user.USER_ID,
    action: 'appA.schedule.editor.open',
    status: 'SUCCESS',
    details: {
      view: view,
      sheetName: sheetName,
      rows: editor.rows.length,
      scope: editor.scope.mode
    }
  });

  return success_({
    sheetName: sheetName,
    view: view,
    head1: editor.head1,
    head2: editor.head2,
    dateColumns: editor.dateColumns,
    rows: editor.rows.slice(0, 500),
    rosterOptions: options,
    accessScope: {
      mode: editor.scope.mode,
      label: editor.scope.label,
      identity: editor.scope.identity
    }
  }, 'Editor Jadwal A542 berhasil dimuat.');
}

function appAScheduleEditorSave_(context, payload, requestId) {
  const appContext = getAppAContext_(context);
  const view = String(payload && payload.view || 'jadwal-all').trim();
  if (['jadwal-all', 'jadwal-spv'].indexOf(view) < 0) {
    throw Object.assign(new Error('Jenis editor tidak valid.'), { code: 'VALIDATION_ERROR' });
  }

  const requested = appAResolveViewSheet_(appContext, view, payload && payload.sheetName);
  const sheetName = appAResolveScheduleSheet_(appContext, requested);
  const editor = appAEditorRows_(appContext, context, sheetName, view);
  const changes = Array.isArray(payload && payload.changes) ? payload.changes : [];

  if (!changes.length) {
    return success_({ updated: 0, sheetName: sheetName }, 'Tidak ada perubahan untuk disimpan.');
  }
  if (changes.length > APP_A_EDITOR_MAX_CHANGES_) {
    throw Object.assign(new Error('Maksimal ' + APP_A_EDITOR_MAX_CHANGES_ + ' perubahan dalam satu penyimpanan.'), { code: 'VALIDATION_ERROR' });
  }

  const allowedRows = {};
  editor.rows.forEach(function(row) { allowedRows[String(row.rowIndex)] = row; });
  const allowedColumns = {};
  editor.dateColumns.forEach(function(column) { allowedColumns[String(column.index)] = true; });

  const rosterOptions = appAEditorRosterOptions_(appContext);
  const allowedValues = {};
  rosterOptions.forEach(function(option) { allowedValues[appANormalizeText_(option.value)] = true; });
  ['', '-', 'OFF', 'O', 'RO', 'AL', 'P', 'X', 'M'].forEach(function(value) {
    allowedValues[appANormalizeText_(value)] = true;
  });

  const normalized = changes.map(function(change) {
    const rowIndex = Number(change && change.rowIndex);
    const columnIndex = Number(change && change.columnIndex);
    const value = String(change && change.value == null ? '' : change.value).trim();
    const originalValue = String(change && change.originalValue == null ? '' : change.originalValue).trim();

    if (!Number.isInteger(rowIndex) || !allowedRows[String(rowIndex)]) {
      throw Object.assign(new Error('Baris tidak termasuk dalam scope akses Anda.'), { code: 'FORBIDDEN' });
    }
    if (!Number.isInteger(columnIndex) || !allowedColumns[String(columnIndex)]) {
      throw Object.assign(new Error('Kolom yang dipilih bukan kolom tanggal yang dapat diedit.'), { code: 'VALIDATION_ERROR' });
    }
    if (!allowedValues[appANormalizeText_(value)]) {
      throw Object.assign(new Error('Nilai roster tidak terdaftar: ' + value), { code: 'VALIDATION_ERROR' });
    }

    return {
      rowIndex: rowIndex,
      columnIndex: columnIndex,
      value: value,
      originalValue: originalValue,
      nip: allowedRows[String(rowIndex)].nip,
      zone: allowedRows[String(rowIndex)].zone
    };
  });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw Object.assign(new Error('Data sedang disimpan pengguna lain. Coba kembali beberapa saat lagi.'), { code: 'CONFLICT' });
  }

  const before = [];
  const after = [];
  try {
    normalized.forEach(function(change) {
      const cell = editor.sheet.getRange(change.rowIndex, change.columnIndex + 1);
      const current = String(cell.getDisplayValue() || '').trim();
      if (current !== change.originalValue) {
        throw Object.assign(new Error(
          'Data berubah sejak editor dibuka pada NIP ' + change.nip + '. Refresh editor sebelum menyimpan.'
        ), { code: 'CONFLICT' });
      }
      before.push({
        rowIndex: change.rowIndex,
        columnIndex: change.columnIndex,
        value: current,
        nip: change.nip,
        zone: change.zone
      });
    });

    normalized.forEach(function(change) {
      editor.sheet.getRange(change.rowIndex, change.columnIndex + 1).setValue(change.value);
      after.push({
        rowIndex: change.rowIndex,
        columnIndex: change.columnIndex,
        value: change.value,
        nip: change.nip,
        zone: change.zone
      });
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  writeAuditLog_({
    requestId: requestId || '',
    userId: context.user.USER_ID,
    action: 'appA.schedule.batch.update',
    status: 'SUCCESS',
    details: {
      view: view,
      sheetName: sheetName,
      count: normalized.length,
      scope: editor.scope.mode,
      before: before,
      after: after
    }
  });

  return success_({
    updated: normalized.length,
    sheetName: sheetName,
    changes: after
  }, normalized.length + ' perubahan jadwal berhasil disimpan.');
}
