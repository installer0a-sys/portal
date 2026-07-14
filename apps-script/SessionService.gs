function getSessionTtlMinutes_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('portal:session-ttl:v1');
  if (cached) return Number(cached) || 480;

  const sheet = getPortalSpreadsheet_().getSheetByName('CONFIG');
  if (!sheet || sheet.getLastRow() < 2) return 480;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(2, sheet.getLastColumn())).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === 'SESSION_TTL_MINUTES') {
      const ttl = Math.max(15, Number(values[i][1]) || 480);
      cache.put('portal:session-ttl:v1', String(ttl), 300);
      return ttl;
    }
  }
  return 480;
}

function createSession_(user) {
  const rawToken = createRandomToken_(48);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getSessionTtlMinutes_() * 60000);
  const sessionId = 'S-' + Utilities.getUuid();
  const sheet = getPortalSpreadsheet_().getSheetByName('SESSIONS');
  const headers = getSheetHeaders_(sheet);
  const record = {
    SESSION_ID: sessionId,
    USER_ID: user.USER_ID,
    TOKEN_HASH: hashSessionToken_(rawToken),
    EXPIRES_AT: expiresAt,
    STATUS: 'ACTIVE',
    CREATED_AT: now,
    LAST_SEEN_AT: now,
    SESSION_VERSION: Number(user.SESSION_VERSION || 1)
  };

  sheet.appendRow(headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  }));

  return {
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
    sessionId: sessionId
  };
}

function validateSession_(rawToken) {
  if (!rawToken) {
    const missing = new Error('Sesi login tidak ditemukan.');
    missing.code = 'AUTH_REQUIRED';
    throw missing;
  }

  const sheet = getPortalSpreadsheet_().getSheetByName('SESSIONS');
  if (!sheet || sheet.getLastRow() < 2) {
    const invalid = new Error('Sesi tidak valid.');
    invalid.code = 'INVALID_SESSION';
    throw invalid;
  }

  const tokenHash = hashSessionToken_(rawToken);
  const headers = getSheetHeaders_(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  let found = null;

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const session = rowToObject_(headers, rows[i]);
    if (constantTimeEquals_(String(session.TOKEN_HASH || ''), tokenHash)) {
      found = { rowNumber: i + 2, data: session };
      break;
    }
  }

  if (!found || String(found.data.STATUS) !== 'ACTIVE') {
    const invalid = new Error('Sesi tidak valid atau sudah logout.');
    invalid.code = 'INVALID_SESSION';
    throw invalid;
  }

  if (new Date(found.data.EXPIRES_AT).getTime() <= Date.now()) {
    updateSessionStatus_(found.rowNumber, 'EXPIRED');
    const expired = new Error('Sesi telah berakhir. Silakan login kembali.');
    expired.code = 'SESSION_EXPIRED';
    throw expired;
  }

  const userRecord = findUserById_(found.data.USER_ID);
  if (!userRecord || String(userRecord.data.STATUS) !== 'ACTIVE') {
    const inactive = new Error('Akun tidak aktif.');
    inactive.code = 'ACCOUNT_INACTIVE';
    throw inactive;
  }

  const storedSessionVersion = Number(found.data.SESSION_VERSION || 1);
  const userSessionVersion = Number(userRecord.data.SESSION_VERSION || 1);
  if (storedSessionVersion !== userSessionVersion) {
    updateSessionStatus_(found.rowNumber, 'REVOKED');
    const revoked = new Error('Sesi telah dicabut. Silakan login kembali.');
    revoked.code = 'SESSION_REVOKED';
    throw revoked;
  }

  return {
    session: found.data,
    user: userRecord.data,
    access: getUserAccess_(userRecord.data)
  };
}

function updateSessionStatus_(rowNumber, status) {
  const sheet = getPortalSpreadsheet_().getSheetByName('SESSIONS');
  const headers = getSheetHeaders_(sheet);
  const index = headers.indexOf('STATUS');
  if (index >= 0) sheet.getRange(rowNumber, index + 1).setValue(status);
}

function revokeSessionFast_(rawToken) {
  if (!rawToken) return { revoked: false, userId: '' };

  const tokenHash = hashSessionToken_(rawToken);
  const sheet = getPortalSpreadsheet_().getSheetByName('SESSIONS');
  if (!sheet || sheet.getLastRow() < 2) return { revoked: false, userId: '' };

  const headers = getSheetHeaders_(sheet);
  const hashIndex = headers.indexOf('TOKEN_HASH');
  const statusIndex = headers.indexOf('STATUS');
  const userIdIndex = headers.indexOf('USER_ID');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (constantTimeEquals_(String(values[i][hashIndex] || ''), tokenHash)) {
      if (statusIndex >= 0 && String(values[i][statusIndex]) === 'ACTIVE') {
        sheet.getRange(i + 2, statusIndex + 1).setValue('LOGGED_OUT');
      }
      return {
        revoked: true,
        userId: userIdIndex >= 0 ? String(values[i][userIdIndex] || '') : ''
      };
    }
  }

  return { revoked: false, userId: '' };
}
