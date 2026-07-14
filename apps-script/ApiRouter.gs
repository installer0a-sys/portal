function routeApi_(request) {
  const action = String(request.action || '');
  const payload = request.payload || {};
  switch (action) {
    case 'system.ping': return success_({ now: new Date().toISOString(), spreadsheetId: SpreadsheetApp.getActive().getId() }, 'Koneksi berhasil.');
    case 'appA.ping': return success_({ appId: 'appA', ready: false }, 'Entry App A terhubung.');
    case 'system.setupSheets': return setupPortalSheets_(payload);
    default: return failure_('API_NOT_FOUND', 'Endpoint tidak ditemukan.');
  }
}
