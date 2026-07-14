const AUTH_HASH_ROUNDS = 1500;
const AUTH_HASH_VERSION = 'v2';
const AUTH_PEPPER_PROPERTY = 'PORTAL_AUTH_PEPPER';

function ensureAuthPepper_() {
  const properties = PropertiesService.getScriptProperties();
  let pepper = properties.getProperty(AUTH_PEPPER_PROPERTY);
  if (!pepper) {
    pepper = createRandomToken_(48);
    properties.setProperty(AUTH_PEPPER_PROPERTY, pepper);
  }
  return pepper;
}

function createPasswordSalt_() {
  return createRandomToken_(24);
}

function hashPassword_(password, salt) {
  const pepper = ensureAuthPepper_();
  let value = String(password || '') + '|' + String(salt || '') + '|' + pepper;

  for (let i = 0; i < AUTH_HASH_ROUNDS; i += 1) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      value,
      Utilities.Charset.UTF_8
    );
    value = bytesToHex_(bytes) + '|' + salt + '|' + pepper;
  }

  return AUTH_HASH_VERSION + '$' + value.split('|')[0];
}

function verifyPassword_(password, salt, storedHash) {
  const stored = String(storedHash || '');

  if (stored.indexOf(AUTH_HASH_VERSION + '$') === 0) {
    return constantTimeEquals_(hashPassword_(password, salt), stored);
  }

  // Kompatibilitas akun v0.2.0 yang masih memakai 12.000 putaran.
  const pepper = ensureAuthPepper_();
  let value = String(password || '') + '|' + String(salt || '') + '|' + pepper;
  for (let i = 0; i < 12000; i += 1) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      value,
      Utilities.Charset.UTF_8
    );
    value = bytesToHex_(bytes) + '|' + salt + '|' + pepper;
  }
  return constantTimeEquals_(value.split('|')[0], stored);
}

function hashSessionToken_(token) {
  const pepper = ensureAuthPepper_();
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(token || '') + '|' + pepper,
    Utilities.Charset.UTF_8
  );
  return bytesToHex_(bytes);
}

function createRandomToken_(byteLength) {
  const chunks = [];
  const count = Math.max(2, Math.ceil((byteLength || 32) / 16));
  for (let i = 0; i < count; i += 1) {
    chunks.push(Utilities.getUuid().replace(/-/g, ''));
  }
  return chunks.join('').slice(0, (byteLength || 32) * 2);
}

function bytesToHex_(bytes) {
  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function constantTimeEquals_(left, right) {
  left = String(left || '');
  right = String(right || '');
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

function normalizeUsername_(username) {
  return String(username || '').trim().toLowerCase();
}

function validateUsername_(username) {
  return /^[a-z0-9._-]{3,40}$/.test(normalizeUsername_(username));
}

function validatePassword_(password) {
  const value = String(password || '');
  return value.length >= 8 && value.length <= 128;
}
