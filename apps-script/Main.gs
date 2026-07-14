const PORTAL_VERSION = '0.1.0';

function doGet() {
  return jsonOutput_(success_({ service: 'Portal V3 API', version: PORTAL_VERSION }, 'API aktif.'));
}

function doPost(e) {
  const started = Date.now();
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const result = routeApi_(request);
    result.meta = Object.assign({}, result.meta, { durationMs: Date.now() - started, version: PORTAL_VERSION, requestId: request.requestId || '' });
    return jsonOutput_(result);
  } catch (error) {
    return jsonOutput_(failure_('SERVER_ERROR', error.message, { durationMs: Date.now() - started, version: PORTAL_VERSION }));
  }
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
