function assertPortalAdmin_(context) {
  if (!context || String(context.user.PORTAL_ROLE || '').toUpperCase() !== 'ADMIN') {
    const error = new Error('Hanya admin portal yang dapat mengelola pengguna.');
    error.code = 'FORBIDDEN';
    throw error;
  }
}

function normalizePortalRole_(value) {
  const role = String(value || 'USER').trim().toUpperCase();
  if (['ADMIN', 'USER'].indexOf(role) < 0) {
    const error = new Error('Portal role harus ADMIN atau USER.');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return role;
}

function normalizeUserStatus_(value) {
  const status = String(value || 'ACTIVE').trim().toUpperCase();
  if (['ACTIVE', 'INACTIVE'].indexOf(status) < 0) {
    const error = new Error('Status user harus ACTIVE atau INACTIVE.');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return status;
}

function listManagedUsers_(context, payload) {
  assertPortalAdmin_(context);
  const sheet = getPortalSpreadsheet_().getSheetByName('USERS');
  const headers = getSheetHeaders_(sheet);
  const query = String(payload && payload.query || '').trim().toLowerCase();
  const includeInactive = payload && payload.includeInactive !== false;
  const rows = sheet && sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];

  const accessMap = getManagedUserAppAccessMap_();
  const users = rows.map(function(row) {
    const item = rowToObject_(headers, row);
    const user = sanitizeManagedUser_(item);
    user.appAccess = accessMap[user.userId] || {};
    user.appRoles = Object.keys(user.appAccess).reduce(function(result, appId) { result[appId] = user.appAccess[appId].role || ''; return result; }, {});
    return user;
  }).filter(function(user) {
    if (!includeInactive && user.status !== 'ACTIVE') return false;
    if (!query) return true;
    return [user.username, user.displayName, user.portalRole, user.status]
      .some(function(value) { return String(value || '').toLowerCase().indexOf(query) >= 0; });
  }).sort(function(left, right) {
    if (left.status !== right.status) return left.status === 'ACTIVE' ? -1 : 1;
    return String(left.displayName || left.username).localeCompare(String(right.displayName || right.username));
  });

  return success_({ users: users, total: users.length, appRoleMaster: getAppRoleMasterMap_() }, 'Daftar user berhasil dimuat.');
}

function getManagedUserRoleMap_() {
  const accessMap = getManagedUserAppAccessMap_();
  const result = {};
  Object.keys(accessMap).forEach(function(userId) {
    result[userId] = {};
    Object.keys(accessMap[userId]).forEach(function(appId) {
      result[userId][appId] = accessMap[userId][appId].role || '';
    });
  });
  return result;
}

function sanitizeManagedUser_(user) {
  return {
    userId: String(user.USER_ID || ''),
    username: String(user.USERNAME || ''),
    displayName: String(user.DISPLAY_NAME || user.USERNAME || ''),
    status: String(user.STATUS || 'INACTIVE').toUpperCase(),
    portalRole: String(user.PORTAL_ROLE || 'USER').toUpperCase(),
    sessionVersion: Number(user.SESSION_VERSION || 1),
    createdAt: user.CREATED_AT ? new Date(user.CREATED_AT).toISOString() : '',
    updatedAt: user.UPDATED_AT ? new Date(user.UPDATED_AT).toISOString() : ''
  };
}

function createManagedUser_(context, payload, requestId) {
  assertPortalAdmin_(context);
  const input = payload || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = createUser_({
      username: input.username,
      displayName: input.displayName,
      password: input.password,
      portalRole: normalizePortalRole_(input.portalRole)
    });
    updateManagedUserFields_(user.userId, {
      displayName: input.displayName,
      status: normalizeUserStatus_(input.status || 'ACTIVE')
    });
    replaceManagedUserAppAccess_(user.userId, normalizeIncomingAppAccess_(input));
    writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'users.create', status: 'SUCCESS', details: { targetUserId: user.userId, username: user.username } });
    const saved = findUserById_(user.userId);
    const result = sanitizeManagedUser_(saved.data);
    result.appAccess = getManagedUserAppAccessMap_()[user.userId] || {};
    result.appRoles = getManagedUserRoleMap_()[user.userId] || {};
    return success_({ user: result }, 'User berhasil ditambahkan.');
  } finally {
    lock.releaseLock();
  }
}

function updateManagedUser_(context, payload, requestId) {
  assertPortalAdmin_(context);
  const userId = String(payload && payload.userId || '');
  const values = payload && payload.values || {};
  const record = findUserById_(userId);
  if (!record) {
    const error = new Error('User tidak ditemukan.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const portalRole = normalizePortalRole_(values.portalRole || record.data.PORTAL_ROLE);
  const status = normalizeUserStatus_(values.status || record.data.STATUS);
  if (userId === String(context.user.USER_ID) && (portalRole !== 'ADMIN' || status !== 'ACTIVE')) {
    const error = new Error('Admin yang sedang login tidak dapat menurunkan role atau menonaktifkan dirinya sendiri.');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    updateManagedUserFields_(userId, {
      displayName: values.displayName,
      portalRole: portalRole,
      status: status,
      bumpSessionVersion: status !== String(record.data.STATUS || '').toUpperCase() || portalRole !== String(record.data.PORTAL_ROLE || '').toUpperCase()
    });
    if (Object.prototype.hasOwnProperty.call(values, 'appAccess') || Object.prototype.hasOwnProperty.call(values, 'appRoles')) replaceManagedUserAppAccess_(userId, normalizeIncomingAppAccess_(values));
    writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'users.update', status: 'SUCCESS', details: { targetUserId: userId, portalRole: portalRole, status: status } });
    const saved = findUserById_(userId);
    const result = sanitizeManagedUser_(saved.data);
    result.appAccess = getManagedUserAppAccessMap_()[userId] || {};
    result.appRoles = getManagedUserRoleMap_()[userId] || {};
    return success_({ user: result }, 'User berhasil diperbarui.');
  } finally {
    lock.releaseLock();
  }
}

function updateManagedUserFields_(userId, values) {
  const record = findUserById_(userId);
  if (!record) throw new Error('User tidak ditemukan.');
  const sheet = getPortalSpreadsheet_().getSheetByName('USERS');
  const headers = getSheetHeaders_(sheet);
  const updates = {
    DISPLAY_NAME: String(values.displayName || record.data.DISPLAY_NAME || record.data.USERNAME || '').trim(),
    PORTAL_ROLE: values.portalRole || record.data.PORTAL_ROLE,
    STATUS: values.status || record.data.STATUS,
    UPDATED_AT: new Date()
  };
  if (values.bumpSessionVersion) updates.SESSION_VERSION = Number(record.data.SESSION_VERSION || 1) + 1;
  Object.keys(updates).forEach(function(header) {
    const index = headers.indexOf(header);
    if (index >= 0) sheet.getRange(record.rowNumber, index + 1).setValue(updates[header]);
  });
}

function resetManagedUserPassword_(context, payload, requestId) {
  assertPortalAdmin_(context);
  const userId = String(payload && payload.userId || '');
  const password = String(payload && payload.password || '');
  if (!validatePassword_(password)) {
    const error = new Error('Password minimal 8 karakter dan maksimal 128 karakter.');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const record = findUserById_(userId);
  if (!record) {
    const error = new Error('User tidak ditemukan.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const salt = createPasswordSalt_();
  const sheet = getPortalSpreadsheet_().getSheetByName('USERS');
  const headers = getSheetHeaders_(sheet);
  const changes = {
    PASSWORD_SALT: salt,
    PASSWORD_HASH: hashPassword_(password, salt),
    SESSION_VERSION: Number(record.data.SESSION_VERSION || 1) + 1,
    UPDATED_AT: new Date()
  };
  Object.keys(changes).forEach(function(header) {
    const index = headers.indexOf(header);
    if (index >= 0) sheet.getRange(record.rowNumber, index + 1).setValue(changes[header]);
  });
  writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'users.resetPassword', status: 'SUCCESS', details: { targetUserId: userId } });
  return success_(null, 'Password berhasil direset dan seluruh sesi lama dicabut.');
}

function revokeManagedUserSessions_(context, payload, requestId) {
  assertPortalAdmin_(context);
  const userId = String(payload && payload.userId || '');
  if (userId === String(context.user.USER_ID)) {
    const error = new Error('Gunakan logout untuk mengakhiri sesi Anda sendiri.');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const record = findUserById_(userId);
  if (!record) {
    const error = new Error('User tidak ditemukan.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  updateManagedUserFields_(userId, { bumpSessionVersion: true });
  writeAuditLog_({ requestId: requestId, userId: context.user.USER_ID, action: 'users.revokeSessions', status: 'SUCCESS', details: { targetUserId: userId } });
  return success_(null, 'Seluruh sesi user berhasil dicabut.');
}

function normalizeIncomingAppAccess_(input) {
  if (input && input.appAccess && typeof input.appAccess === 'object') return input.appAccess;
  const legacy = input && input.appRoles || {};
  const result = {};
  Object.keys(legacy).forEach(function(appId) {
    result[appId] = { access: true, status: 'ACTIVE', role: legacy[appId] || '' };
  });
  return result;
}

function replaceManagedUserAppRoles_(userId, appRoles) {
  replaceManagedUserAppAccess_(userId, normalizeIncomingAppAccess_({ appRoles: appRoles || {} }));
}
