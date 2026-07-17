const APP_A_GENERATE_MAX_CELLS_ = 12000;

function appAGenerateRequireAdmin_(context) {
  appARequireAdmin_(context);
}

function appAGenerateOptions_(context, payload) {
  appAGenerateRequireAdmin_(context);
  const appContext = getAppAContext_(context);
  const requested = String(payload && payload.sheetName || '').trim();
  const sheetName = appAResolveScheduleSheet_(appContext, requested);
  const editor = appAEditorRows_(appContext, context, sheetName, 'jadwal-all');
  const rosterOptions = appAEditorRosterOptions_(appContext);

  return success_({
    sheetName: sheetName,
    sheets: appAListMonthSheets_(appContext.spreadsheet),
    dateColumns: editor.dateColumns,
    rosterOptions: rosterOptions,
    employees: editor.rows.map(function(row) {
      return {
        rowIndex: row.rowIndex,
        nip: row.nip,
        name: row.name,
        department: row.department,
        zone: row.zone
      };
    }),
    defaults: {
      overwrite: false,
      sequence: rosterOptions.slice(0, 3).map(function(option) { return option.value; })
    }
  }, 'Opsi Generate Jadwal berhasil dimuat.');
}

function appAGenerateNormalizeSequence_(appContext, rawSequence) {
  const rosterOptions = appAEditorRosterOptions_(appContext);
  const allowed = {};
  rosterOptions.forEach(function(option) {
    allowed[appANormalizeText_(option.value)] = option.value;
  });

  const sequence = (Array.isArray(rawSequence) ? rawSequence : [])
    .map(function(value) { return String(value || '').trim(); })
    .filter(Boolean);

  if (!sequence.length) {
    throw Object.assign(new Error('Pilih minimal satu kode roster untuk pola generate.'), {
      code: 'VALIDATION_ERROR',
      field: 'sequence'
    });
  }

  return sequence.map(function(value) {
    const normalized = appANormalizeText_(value);
    if (!allowed[normalized]) {
      throw Object.assign(new Error('Kode roster tidak terdaftar: ' + value), {
        code: 'VALIDATION_ERROR',
        field: 'sequence'
      });
    }
    return allowed[normalized];
  });
}

function appAGenerateBuildPlan_(context, payload) {
  appAGenerateRequireAdmin_(context);
  const appContext = getAppAContext_(context);
  const requested = String(payload && payload.sheetName || '').trim();
  const sheetName = appAResolveScheduleSheet_(appContext, requested);
  const editor = appAEditorRows_(appContext, context, sheetName, 'jadwal-all');
  const sequence = appAGenerateNormalizeSequence_(appContext, payload && payload.sequence);
  const overwrite = Boolean(payload && payload.overwrite);
  const zoneFilter = appANormalizeText_(payload && payload.zone);
  const selectedDays = Array.isArray(payload && payload.days)
    ? payload.days.map(function(value) { return String(value); })
    : [];

  const dateColumns = editor.dateColumns.filter(function(column) {
    return !selectedDays.length || selectedDays.indexOf(String(column.day)) >= 0;
  });

  if (!dateColumns.length) {
    throw Object.assign(new Error('Tidak ada tanggal yang dipilih untuk generate.'), {
      code: 'VALIDATION_ERROR',
      field: 'days'
    });
  }

  const rows = editor.rows.filter(function(row) {
    return !zoneFilter || appANormalizeText_(row.zone) === zoneFilter;
  });

  const changes = [];
  let skippedFilled = 0;

  rows.forEach(function(row, employeeOffset) {
    dateColumns.forEach(function(column, dayOffset) {
      const current = String(row.values[column.index] || '').trim();
      if (current && !overwrite) {
        skippedFilled += 1;
        return;
      }

      const value = sequence[(employeeOffset + dayOffset) % sequence.length];
      if (value === current) return;

      changes.push({
        rowIndex: row.rowIndex,
        columnIndex: column.index,
        originalValue: current,
        value: value,
        nip: row.nip,
        name: row.name,
        zone: row.zone,
        day: column.day,
        weekday: column.weekday || ''
      });
    });
  });

  if (changes.length > APP_A_GENERATE_MAX_CELLS_) {
    throw Object.assign(new Error(
      'Rencana generate melebihi batas ' + APP_A_GENERATE_MAX_CELLS_ + ' sel.'
    ), {
      code: 'VALIDATION_ERROR',
      field: 'days'
    });
  }

  const summary = appAEditorSummary_(changes);
  const previewRows = {};
  changes.forEach(function(change) {
    const key = String(change.rowIndex);
    if (!previewRows[key]) {
      previewRows[key] = {
        rowIndex: change.rowIndex,
        nip: change.nip,
        name: change.name,
        zone: change.zone,
        values: {}
      };
    }
    previewRows[key].values[String(change.day)] = change.value;
  });

  return {
    appContext: appContext,
    editor: editor,
    sheetName: sheetName,
    sequence: sequence,
    overwrite: overwrite,
    zone: String(payload && payload.zone || '').trim(),
    days: dateColumns.map(function(column) { return String(column.day); }),
    changes: changes,
    skippedFilled: skippedFilled,
    summary: summary,
    previewRows: Object.keys(previewRows).map(function(key) { return previewRows[key]; }),
    planHash: appAEditorChangeHash_(changes)
  };
}

function appAGeneratePreview_(context, payload, requestId) {
  const plan = appAGenerateBuildPlan_(context, payload);

  writeAuditLog_({
    requestId: requestId || '',
    userId: context.user.USER_ID,
    action: 'appA.schedule.generate.preview',
    status: 'SUCCESS',
    details: {
      version: '0.6.0',
      sheetName: plan.sheetName,
      sequence: plan.sequence,
      overwrite: plan.overwrite,
      zone: plan.zone,
      days: plan.days,
      cells: plan.changes.length,
      skippedFilled: plan.skippedFilled,
      planHash: plan.planHash
    }
  });

  return success_({
    sheetName: plan.sheetName,
    sequence: plan.sequence,
    overwrite: plan.overwrite,
    zone: plan.zone,
    days: plan.days,
    changes: plan.changes,
    previewRows: plan.previewRows,
    summary: plan.summary,
    skippedFilled: plan.skippedFilled,
    planHash: plan.planHash
  }, 'Preview Generate Jadwal berhasil dibuat. Belum ada data yang ditulis.');
}

function appAGenerateApply_(context, payload, requestId) {
  const plan = appAGenerateBuildPlan_(context, payload);
  const expectedHash = String(payload && payload.planHash || '').trim();

  if (!expectedHash || expectedHash !== plan.planHash) {
    throw Object.assign(new Error(
      'Preview sudah berubah atau tidak cocok. Buat preview ulang sebelum menerapkan.'
    ), {
      code: 'CONFLICT',
      field: 'planHash'
    });
  }

  if (!plan.changes.length) {
    return success_({
      updated: 0,
      sheetName: plan.sheetName,
      planHash: plan.planHash
    }, 'Tidak ada sel yang perlu diperbarui.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw Object.assign(new Error('Proses generate sedang digunakan pengguna lain.'), {
      code: 'CONFLICT'
    });
  }

  const before = [];
  const after = [];

  try {
    plan.changes.forEach(function(change) {
      const cell = plan.editor.sheet.getRange(change.rowIndex, change.columnIndex + 1);
      const current = String(cell.getDisplayValue() || '').trim();

      if (current !== change.originalValue) {
        throw Object.assign(new Error(
          'Data berubah setelah preview pada NIP ' + change.nip +
          ', tanggal ' + change.day + '. Buat preview ulang.'
        ), {
          code: 'CONFLICT'
        });
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

    plan.changes.forEach(function(change) {
      plan.editor.sheet
        .getRange(change.rowIndex, change.columnIndex + 1)
        .setValue(change.value);

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

  writeAuditLog_({
    requestId: requestId || '',
    userId: context.user.USER_ID,
    action: 'appA.schedule.generate.apply',
    status: 'SUCCESS',
    details: {
      version: '0.6.0',
      sheetName: plan.sheetName,
      sequence: plan.sequence,
      overwrite: plan.overwrite,
      zone: plan.zone,
      days: plan.days,
      count: after.length,
      skippedFilled: plan.skippedFilled,
      planHash: plan.planHash,
      before: before,
      after: after
    }
  });

  return success_({
    updated: after.length,
    sheetName: plan.sheetName,
    summary: appAEditorSummary_(after),
    skippedFilled: plan.skippedFilled,
    planHash: plan.planHash
  }, after.length + ' sel jadwal berhasil digenerate.');
}
