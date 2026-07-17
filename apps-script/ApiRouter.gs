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

    case 'appA.dashboard': {
      const context = validateSession_(sessionToken);
      return appADashboard_(context, payload);
    }

    case 'appA.schedule.list': {
      const context = validateSession_(sessionToken);
      return appAScheduleList_(context, payload);
    }

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

    case 'data.list': {
      const context = validateSession_(sessionToken);
      return listDatasetRecords_(context, payload);
    }

    case 'data.get': {
      const context = validateSession_(sessionToken);
      return getDatasetRecord_(context, payload);
    }

    case 'data.create': {
      const context = validateSession_(sessionToken);
      return createDatasetRecord_(context, payload, requestId);
    }

    case 'data.update': {
      const context = validateSession_(sessionToken);
      return updateDatasetRecord_(context, payload, requestId);
    }

    case 'data.delete': {
      const context = validateSession_(sessionToken);
      return deleteDatasetRecord_(context, payload, requestId);
    }

    case 'data.restore': {
      const context = validateSession_(sessionToken);
      return restoreDatasetRecord_(context, payload, requestId);
    }



    case 'users.list': {
      const context = validateSession_(sessionToken);
      return listManagedUsers_(context, payload);
    }

    case 'users.create': {
      const context = validateSession_(sessionToken);
      return createManagedUser_(context, payload, requestId);
    }

    case 'users.update': {
      const context = validateSession_(sessionToken);
      return updateManagedUser_(context, payload, requestId);
    }

    case 'users.resetPassword': {
      const context = validateSession_(sessionToken);
      return resetManagedUserPassword_(context, payload, requestId);
    }

    case 'users.revokeSessions': {
      const context = validateSession_(sessionToken);
      return revokeManagedUserSessions_(context, payload, requestId);
    }

    case 'apps.list': {
      const context = validateSession_(sessionToken);
      return listRegisteredApps_(context, payload);
    }

    case 'apps.get': {
      const context = validateSession_(sessionToken);
      return getRegisteredApp_(context, payload);
    }

    case 'apps.create': {
      const context = validateSession_(sessionToken);
      return createRegisteredApp_(context, payload, requestId);
    }

    case 'apps.update': {
      const context = validateSession_(sessionToken);
      return updateRegisteredApp_(context, payload, requestId);
    }

    case 'apps.delete': {
      const context = validateSession_(sessionToken);
      return deleteRegisteredApp_(context, payload, requestId);
    }

    case 'apps.restore': {
      const context = validateSession_(sessionToken);
      return restoreRegisteredApp_(context, payload, requestId);
    }

    case 'apps.move': {
      const context = validateSession_(sessionToken);
      return moveRegisteredApp_(context, payload, requestId);
    }

    case 'apps.validateConnection': {
      const context = validateSession_(sessionToken);
      return validateRegisteredAppConnection_(context, payload);
    }

    case 'apps.syncConfig': {
      const context = validateSession_(sessionToken);
      return syncRegisteredAppConfig_(context, payload, requestId);
    }

    case 'apps.config': {
      const context = validateSession_(sessionToken);
      return getRegisteredAppConfig_(context, payload);
    }

    case 'logs.list': {
      const context = validateSession_(sessionToken);
      return listCentralLogs_(context, payload);
    }

    case 'system.setupSheets': {
      const context = validateSession_(sessionToken);
      requirePermission_(context, 'portal.settings');
      return setupPortalSheets_();
    }

    default:
      return failure_('API_NOT_FOUND', 'Endpoint tidak ditemukan.');
  }
}
