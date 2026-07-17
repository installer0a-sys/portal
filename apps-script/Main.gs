const PORTAL_VERSION = '0.4.9';

function doGet() {
  return jsonOutput_(success_({ service: 'Portal Azko Kudus Sudirman API', version: PORTAL_VERSION }, 'API aktif.'));
}

function doPost(e) {
  const started = Date.now();
  let request = {};

  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const result = routeApi_(request);
    result.meta = Object.assign({}, result.meta, {
      durationMs: Date.now() - started,
      version: PORTAL_VERSION,
      requestId: request.requestId || ''
    });
    return jsonOutput_(result);
  } catch (error) {
    const code = String(error && error.code || 'SERVER_ERROR');
    const safeMessage = code === 'SERVER_ERROR'
      ? 'Terjadi kesalahan pada server.'
      : String(error && error.message || 'Permintaan gagal.');

    writeSystemErrorSafe_(error, request);

    return jsonOutput_(failure_(code, safeMessage, {
      durationMs: Date.now() - started,
      version: PORTAL_VERSION,
      requestId: request.requestId || '',
      field: String(error && error.field || '')
    }));
  }
}

function writeSystemErrorSafe_(error, request) {
  try {
    const sheet = getPortalSpreadsheet_().getSheetByName('SYSTEM_LOG');
    if (!sheet) return;
    const headers = getSheetHeaders_(sheet);
    const record = {
      TIMESTAMP: new Date(),
      LEVEL: 'ERROR',
      SOURCE: 'doPost',
      MESSAGE: String(error && error.message || 'Unknown error'),
      REQUEST_ID: String(request && request.requestId || ''),
      DETAILS: JSON.stringify({
        action: String(request && request.action || ''),
        code: String(error && error.code || 'SERVER_ERROR')
      })
    };
    sheet.appendRow(headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    }));
  } catch (ignored) {}
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
