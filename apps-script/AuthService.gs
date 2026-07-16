function login_(payload, requestId) {
  const started = Date.now();
  const username = normalizeUsername_(payload && payload.username);
  const password = String(payload && payload.password || '');

  assertLoginRateLimit_(username);

  try {
    const userRecord = findUserByUsername_(username);
    const genericError = 'Username atau password salah.';

    if (!userRecord || String(userRecord.data.STATUS) !== 'ACTIVE') {
      recordLoginFailure_(username);
      const invalidCredentials = new Error(genericError);
      invalidCredentials.code = 'INVALID_CREDENTIALS';
      throw invalidCredentials;
    }

    if (!verifyPassword_(password, userRecord.data.PASSWORD_SALT, userRecord.data.PASSWORD_HASH)) {
      recordLoginFailure_(username);
      const invalidCredentials = new Error(genericError);
      invalidCredentials.code = 'INVALID_CREDENTIALS';
      throw invalidCredentials;
    }

    // Upgrade otomatis hash lama setelah login pertama berhasil.
    if (String(userRecord.data.PASSWORD_HASH || '').indexOf(AUTH_HASH_VERSION + '$') !== 0) {
      const headers = getSheetHeaders_(userRecord.sheet || getPortalSpreadsheet_().getSheetByName('USERS'));
      const hashIndex = headers.indexOf('PASSWORD_HASH');
      if (hashIndex >= 0) {
        getPortalSpreadsheet_().getSheetByName('USERS')
          .getRange(userRecord.rowNumber, hashIndex + 1)
          .setValue(hashPassword_(password, userRecord.data.PASSWORD_SALT));
      }
    }

    clearLoginFailures_(username);
    const session = createSession_(userRecord.data);
    const access = getUserAccess_(userRecord.data);

    writeAuditLog_({
      requestId: requestId,
      userId: userRecord.data.USER_ID,
      action: 'auth.login',
      status: 'SUCCESS',
      durationMs: Date.now() - started
    });

    return success_({
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      user: sanitizeUser_(userRecord.data),
      access: access
    }, 'Login berhasil.');
  } catch (error) {
    writeAuditLog_({
      requestId: requestId,
      action: 'auth.login',
      status: 'FAILED',
      durationMs: Date.now() - started,
      details: { username: username, message: error.message }
    });
    throw error;
  }
}

function getSessionProfile_(sessionToken) {
  const context = validateSession_(sessionToken);
  return success_({
    user: sanitizeUser_(context.user),
    access: context.access,
    expiresAt: new Date(context.session.EXPIRES_AT).toISOString()
  }, 'Sesi aktif.');
}

function logout_(sessionToken, requestId) {
  const result = revokeSessionFast_(sessionToken);
  writeAuditLog_({
    requestId: requestId,
    userId: result.userId || '',
    action: 'auth.logout',
    status: 'SUCCESS'
  });
  return success_(null, 'Logout berhasil.');
}
