function listDatasetRecords_(context, payload) {
  const input = requireObject_(payload || {}, 'payload');
  const definition = getDatasetDefinition_(input.dataset);
  requirePermission_(context, definition.permissions.list);

  const page = requirePositiveInteger_(input.page, 'page', 1);
  const pageSize = requirePositiveInteger_(input.pageSize, 'pageSize', 25, 100);
  const query = String(input.query || '').trim().toLowerCase();
  const includeDeleted = Boolean(input.includeDeleted) && hasPermission_(context, definition.permissions.restore);
  const status = input.status ? requireEnum_(input.status, 'status', definition.allowedStatus) : '';
  const sheet = requireDatasetSheet_(definition);
  const headers = getSheetHeaders_(sheet);
  const rows = sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];

  let records = rows.map(function(row) { return rowToObject_(headers, row); }).filter(function(record) {
    if (!includeDeleted && record.DELETED_AT) return false;
    if (status && String(record.STATUS || '').toUpperCase() !== status) return false;
    if (!query) return true;
    return [record.RECORD_ID, record.TITLE, record.DESCRIPTION, record.STATUS]
      .some(function(value) { return String(value || '').toLowerCase().indexOf(query) >= 0; });
  });

  records.sort(function(left, right) {
    return new Date(right.UPDATED_AT || right.CREATED_AT || 0).getTime()
      - new Date(left.UPDATED_AT || left.CREATED_AT || 0).getTime();
  });

  const total = records.length;
  const start = (page - 1) * pageSize;
  records = records.slice(start, start + pageSize).map(sanitizeDatasetRecord_);

  return success_({
    dataset: String(input.dataset),
    records: records,
    pagination: {
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  }, 'Data berhasil dimuat.');
}

function getDatasetRecord_(context, payload) {
  const input = requireObject_(payload || {}, 'payload');
  const definition = getDatasetDefinition_(input.dataset);
  requirePermission_(context, definition.permissions.get);
  const recordId = requireString_(input.recordId, 'recordId', { required: true, maxLength: 100 });
  const found = findDatasetRecord_(definition, recordId);
  if (!found || (found.data.DELETED_AT && !hasPermission_(context, definition.permissions.restore))) {
    throwDataError_('RECORD_NOT_FOUND', 'Data tidak ditemukan.');
  }
  return success_({ dataset: String(input.dataset), record: sanitizeDatasetRecord_(found.data) }, 'Data ditemukan.');
}

function createDatasetRecord_(context, payload, requestId) {
  const input = requireObject_(payload || {}, 'payload');
  const definition = getDatasetDefinition_(input.dataset);
  requirePermission_(context, definition.permissions.create);
  const values = validateDatasetValues_(definition, input.values || {}, true);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throwDataError_('WRITE_BUSY', 'Data sedang diproses. Silakan coba kembali.');

  try {
    const sheet = requireDatasetSheet_(definition);
    const headers = getSheetHeaders_(sheet);
    const now = new Date();
    const record = Object.assign({}, definition.defaultValues, values, {
      RECORD_ID: definition.idPrefix + '-' + Utilities.getUuid(),
      ROW_VERSION: 1,
      CREATED_BY: String(context.user.USER_ID || ''),
      CREATED_AT: now,
      UPDATED_BY: String(context.user.USER_ID || ''),
      UPDATED_AT: now,
      DELETED_BY: '',
      DELETED_AT: ''
    });
    sheet.appendRow(headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    }));
    writeDataAudit_(context, requestId, 'data.create', 'SUCCESS', input.dataset, record.RECORD_ID, { rowVersion: 1 });
    return success_({ dataset: String(input.dataset), record: sanitizeDatasetRecord_(record) }, 'Data berhasil disimpan.');
  } finally {
    lock.releaseLock();
  }
}

function updateDatasetRecord_(context, payload, requestId) {
  const input = requireObject_(payload || {}, 'payload');
  const definition = getDatasetDefinition_(input.dataset);
  requirePermission_(context, definition.permissions.update);
  const recordId = requireString_(input.recordId, 'recordId', { required: true, maxLength: 100 });
  const expectedVersion = requirePositiveInteger_(input.rowVersion, 'rowVersion');
  const values = validateDatasetValues_(definition, input.values || {}, false);
  if (!Object.keys(values).length) throwDataError_('VALIDATION_ERROR', 'Tidak ada perubahan yang dapat disimpan.');

  return withDatasetWriteLock_(function() {
    const found = findDatasetRecord_(definition, recordId);
    if (!found || found.data.DELETED_AT) throwDataError_('RECORD_NOT_FOUND', 'Data tidak ditemukan.');
    const currentVersion = Number(found.data.ROW_VERSION || 1);
    if (currentVersion !== expectedVersion) {
      throwDataError_('VERSION_CONFLICT', 'Data telah berubah. Muat ulang sebelum menyimpan.');
    }
    const updated = Object.assign({}, found.data, values, {
      ROW_VERSION: currentVersion + 1,
      UPDATED_BY: String(context.user.USER_ID || ''),
      UPDATED_AT: new Date()
    });
    writeDatasetRow_(definition, found.rowNumber, updated);
    writeDataAudit_(context, requestId, 'data.update', 'SUCCESS', input.dataset, recordId, {
      previousVersion: currentVersion,
      rowVersion: currentVersion + 1,
      fields: Object.keys(values)
    });
    return success_({ dataset: String(input.dataset), record: sanitizeDatasetRecord_(updated) }, 'Data berhasil diperbarui.');
  });
}

function deleteDatasetRecord_(context, payload, requestId) {
  const input = requireObject_(payload || {}, 'payload');
  const definition = getDatasetDefinition_(input.dataset);
  requirePermission_(context, definition.permissions.delete);
  const recordId = requireString_(input.recordId, 'recordId', { required: true, maxLength: 100 });
  const expectedVersion = requirePositiveInteger_(input.rowVersion, 'rowVersion');

  return withDatasetWriteLock_(function() {
    const found = findDatasetRecord_(definition, recordId);
    if (!found || found.data.DELETED_AT) throwDataError_('RECORD_NOT_FOUND', 'Data tidak ditemukan.');
    const currentVersion = Number(found.data.ROW_VERSION || 1);
    if (currentVersion !== expectedVersion) throwDataError_('VERSION_CONFLICT', 'Data telah berubah. Muat ulang sebelum menghapus.');
    const now = new Date();
    const deleted = Object.assign({}, found.data, {
      ROW_VERSION: currentVersion + 1,
      UPDATED_BY: String(context.user.USER_ID || ''),
      UPDATED_AT: now,
      DELETED_BY: String(context.user.USER_ID || ''),
      DELETED_AT: now
    });
    writeDatasetRow_(definition, found.rowNumber, deleted);
    writeDataAudit_(context, requestId, 'data.delete', 'SUCCESS', input.dataset, recordId, { rowVersion: currentVersion + 1 });
    return success_({ dataset: String(input.dataset), recordId: recordId, rowVersion: currentVersion + 1 }, 'Data berhasil dihapus.');
  });
}

function restoreDatasetRecord_(context, payload, requestId) {
  const input = requireObject_(payload || {}, 'payload');
  const definition = getDatasetDefinition_(input.dataset);
  requirePermission_(context, definition.permissions.restore);
  const recordId = requireString_(input.recordId, 'recordId', { required: true, maxLength: 100 });
  const expectedVersion = requirePositiveInteger_(input.rowVersion, 'rowVersion');

  return withDatasetWriteLock_(function() {
    const found = findDatasetRecord_(definition, recordId);
    if (!found || !found.data.DELETED_AT) throwDataError_('RECORD_NOT_FOUND', 'Data terhapus tidak ditemukan.');
    const currentVersion = Number(found.data.ROW_VERSION || 1);
    if (currentVersion !== expectedVersion) throwDataError_('VERSION_CONFLICT', 'Data telah berubah. Muat ulang sebelum memulihkan.');
    const restored = Object.assign({}, found.data, {
      ROW_VERSION: currentVersion + 1,
      UPDATED_BY: String(context.user.USER_ID || ''),
      UPDATED_AT: new Date(),
      DELETED_BY: '',
      DELETED_AT: ''
    });
    writeDatasetRow_(definition, found.rowNumber, restored);
    writeDataAudit_(context, requestId, 'data.restore', 'SUCCESS', input.dataset, recordId, { rowVersion: currentVersion + 1 });
    return success_({ dataset: String(input.dataset), record: sanitizeDatasetRecord_(restored) }, 'Data berhasil dipulihkan.');
  });
}

function validateDatasetValues_(definition, values, isCreate) {
  const input = requireObject_(values, 'values');
  const output = {};
  definition.writableFields.forEach(function(field) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    if (field === 'TITLE') output.TITLE = requireString_(input.TITLE, 'TITLE', { required: isCreate, maxLength: 200 });
    if (field === 'DESCRIPTION') output.DESCRIPTION = requireString_(input.DESCRIPTION, 'DESCRIPTION', { maxLength: 5000 });
    if (field === 'STATUS') output.STATUS = requireEnum_(input.STATUS, 'STATUS', definition.allowedStatus, definition.defaultValues.STATUS);
  });
  if (isCreate) {
    definition.requiredFields.forEach(function(field) {
      if (!output[field]) throwValidation_(field, 'wajib diisi.');
    });
  }
  return output;
}

function requireDatasetSheet_(definition) {
  const sheet = getPortalSpreadsheet_().getSheetByName(definition.sheetName);
  if (!sheet) throwDataError_('DATASET_NOT_READY', 'Struktur data belum disiapkan. Jalankan setupPortalSheets().');
  return sheet;
}

function findDatasetRecord_(definition, recordId) {
  const sheet = requireDatasetSheet_(definition);
  if (sheet.getLastRow() < 2) return null;
  const headers = getSheetHeaders_(sheet);
  const idIndex = headers.indexOf(definition.idColumn);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index][idIndex]) === String(recordId)) {
      return { rowNumber: index + 2, data: rowToObject_(headers, rows[index]) };
    }
  }
  return null;
}

function writeDatasetRow_(definition, rowNumber, record) {
  const sheet = requireDatasetSheet_(definition);
  const headers = getSheetHeaders_(sheet);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  })]);
}

function withDatasetWriteLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throwDataError_('WRITE_BUSY', 'Data sedang diproses. Silakan coba kembali.');
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function sanitizeDatasetRecord_(record) {
  const output = {};
  Object.keys(record || {}).forEach(function(key) {
    const value = record[key];
    output[toCamelCase_(key)] = value instanceof Date ? value.toISOString() : value;
  });
  return output;
}

function toCamelCase_(value) {
  return String(value || '').toLowerCase().replace(/_([a-z])/g, function(match, letter) { return letter.toUpperCase(); });
}

function writeDataAudit_(context, requestId, action, status, dataset, recordId, details) {
  writeAuditLog_({
    requestId: requestId || '',
    userId: String(context && context.user && context.user.USER_ID || ''),
    action: action,
    status: status,
    details: Object.assign({ dataset: dataset, recordId: recordId }, details || {})
  });
}

function throwDataError_(code, message) {
  const error = new Error(message || 'Operasi data gagal.');
  error.code = code || 'DATA_ERROR';
  throw error;
}
