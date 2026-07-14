function routeApi_(request) {
  const action = String(request.action || '');
  const payload = request.payload || {};
  const requestId = request.requestId || '';
  const sessionToken = request.sessionToken || '';

  switch (action) {
    case 'system.ping':
      return success_({ now: new Date().toISOString(), spreadsheetId: SpreadsheetApp.getActive().getId() }, 'Koneksi berhasil.');

    case 'auth.login':
      return login_(payload, requestId);

    case 'auth.session':
      return getSessionProfile_(sessionToken);

    case 'auth.logout':
      return logout_(sessionToken, requestId);

    case 'appA.ping': {
      const context = validateSession_(sessionToken);
      requirePermission_(context, 'appA.access');
      return success_({
        appId: 'appA',
        ready: false,
        user: sanitizeUser_(context.user),
        role: context.access.appRoles.appA || '',
        permissionSignature: context.access.permissionSignature
      }, 'Entry App A terhubung.');
    }

    case 'system.setupSheets':
      return setupPortalSheets_(payload);

    default:
      return failure_('API_NOT_FOUND', 'Endpoint tidak ditemukan.');
  }
}
