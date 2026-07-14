function getPortalSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
}

function rowToObject_(headers, row) {
  const object = {};
  headers.forEach(function(header, index) {
    object[header] = row[index];
  });
  return object;
}

function findUserByUsername_(username) {
  const sheet = getPortalSpreadsheet_().getSheetByName('USERS');
  if (!sheet || sheet.getLastRow() < 2) return null;

  const headers = getSheetHeaders_(sheet);
  const usernameIndex = headers.indexOf('USERNAME');
  if (usernameIndex < 0) throw new Error('Header USERNAME tidak ditemukan.');

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const normalized = normalizeUsername_(username);

  for (let i = 0; i < values.length; i += 1) {
    if (normalizeUsername_(values[i][usernameIndex]) === normalized) {
      return {
        rowNumber: i + 2,
        data: rowToObject_(headers, values[i])
      };
    }
  }
  return null;
}

function findUserById_(userId) {
  const sheet = getPortalSpreadsheet_().getSheetByName('USERS');
  if (!sheet || sheet.getLastRow() < 2) return null;

  const headers = getSheetHeaders_(sheet);
  const idIndex = headers.indexOf('USER_ID');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][idIndex]) === String(userId)) {
      return {
        rowNumber: i + 2,
        data: rowToObject_(headers, values[i])
      };
    }
  }
  return null;
}

function createUser_(input) {
  const username = normalizeUsername_(input.username);
  const password = String(input.password || '');
  const portalRole = String(input.portalRole || 'USER').toUpperCase();

  if (!validateUsername_(username)) {
    throw new Error('Username harus 3-40 karakter dan hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau strip.');
  }
  if (!validatePassword_(password)) {
    throw new Error('Password minimal 8 karakter dan maksimal 128 karakter.');
  }
  if (findUserByUsername_(username)) {
    throw new Error('Username sudah digunakan.');
  }

  const sheet = getPortalSpreadsheet_().getSheetByName('USERS');
  const headers = getSheetHeaders_(sheet);
  const salt = createPasswordSalt_();
  const now = new Date();
  const record = {
    USER_ID: 'U-' + Utilities.getUuid(),
    USERNAME: username,
    PASSWORD_HASH: hashPassword_(password, salt),
    PASSWORD_SALT: salt,
    STATUS: 'ACTIVE',
    PORTAL_ROLE: portalRole,
    SESSION_VERSION: 1,
    CREATED_AT: now,
    UPDATED_AT: now
  };

  sheet.appendRow(headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  }));

  return sanitizeUser_(record);
}

function sanitizeUser_(user) {
  return {
    userId: String(user.USER_ID || ''),
    username: String(user.USERNAME || ''),
    status: String(user.STATUS || ''),
    portalRole: String(user.PORTAL_ROLE || 'USER'),
    sessionVersion: Number(user.SESSION_VERSION || 1)
  };
}

function addUserAppRole_(userId, appId, role) {
  const sheet = getPortalSpreadsheet_().getSheetByName('USER_APP_ROLES');
  const headers = getSheetHeaders_(sheet);
  const now = new Date();
  const record = {
    USER_ID: userId,
    APP_ID: appId,
    ROLE: String(role || '').toUpperCase(),
    STATUS: 'ACTIVE',
    CREATED_AT: now,
    UPDATED_AT: now
  };
  sheet.appendRow(headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  }));
}
