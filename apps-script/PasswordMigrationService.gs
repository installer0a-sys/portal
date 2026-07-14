function migrateUserPasswordHashV2() {
  const properties = PropertiesService.getScriptProperties();
  const username = normalizeUsername_(properties.getProperty('MIGRATE_USERNAME'));
  const password = String(properties.getProperty('MIGRATE_PASSWORD') || '');

  if (!username || !validatePassword_(password)) {
    throw new Error('Isi Script Properties MIGRATE_USERNAME dan MIGRATE_PASSWORD terlebih dahulu.');
  }

  const userRecord = findUserByUsername_(username);
  if (!userRecord) {
    throw new Error('User tidak ditemukan: ' + username);
  }

  const sheet = getPortalSpreadsheet_().getSheetByName('USERS');
  const headers = getSheetHeaders_(sheet);
  const hashIndex = headers.indexOf('PASSWORD_HASH');
  const saltIndex = headers.indexOf('PASSWORD_SALT');
  const updatedIndex = headers.indexOf('UPDATED_AT');

  if (hashIndex < 0 || saltIndex < 0) {
    throw new Error('Header PASSWORD_HASH atau PASSWORD_SALT tidak ditemukan.');
  }

  const salt = createPasswordSalt_();
  sheet.getRange(userRecord.rowNumber, hashIndex + 1).setValue(hashPassword_(password, salt));
  sheet.getRange(userRecord.rowNumber, saltIndex + 1).setValue(salt);
  if (updatedIndex >= 0) {
    sheet.getRange(userRecord.rowNumber, updatedIndex + 1).setValue(new Date());
  }

  properties.deleteProperty('MIGRATE_USERNAME');
  properties.deleteProperty('MIGRATE_PASSWORD');

  return {
    ok: true,
    username: username,
    hashVersion: AUTH_HASH_VERSION,
    rounds: AUTH_HASH_ROUNDS
  };
}
