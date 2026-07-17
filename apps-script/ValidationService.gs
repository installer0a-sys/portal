function requireObject_(value, fieldName) {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]' || Array.isArray(value)) {
    throwValidation_(fieldName || 'payload', 'harus berupa object.');
  }
  return value;
}

function requireString_(value, fieldName, options) {
  const settings = options || {};
  const text = String(value == null ? '' : value).trim();
  if (settings.required && !text) throwValidation_(fieldName, 'wajib diisi.');
  if (settings.minLength && text.length < settings.minLength) {
    throwValidation_(fieldName, 'minimal ' + settings.minLength + ' karakter.');
  }
  if (settings.maxLength && text.length > settings.maxLength) {
    throwValidation_(fieldName, 'maksimal ' + settings.maxLength + ' karakter.');
  }
  return text;
}

function requirePositiveInteger_(value, fieldName, fallback, max) {
  if (value === '' || value == null) {
    if (fallback != null) return fallback;
    throwValidation_(fieldName, 'wajib diisi.');
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throwValidation_(fieldName, 'harus bilangan bulat positif.');
  return max ? Math.min(number, max) : number;
}

function requireEnum_(value, fieldName, allowed, fallback) {
  const normalized = String(value == null || value === '' ? fallback || '' : value).trim().toUpperCase();
  if (allowed.indexOf(normalized) < 0) {
    throwValidation_(fieldName, 'tidak valid.');
  }
  return normalized;
}

function throwValidation_(field, message) {
  const error = new Error(String(field || 'field') + ' ' + String(message || 'tidak valid.'));
  error.code = 'VALIDATION_ERROR';
  error.field = String(field || '');
  throw error;
}
