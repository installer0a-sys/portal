function success_(data, message, meta) {
  return { ok: true, data: data == null ? null : data, message: message || '', meta: meta || {} };
}
function failure_(code, message, meta) {
  return { ok: false, data: null, message: message || 'Terjadi kesalahan.', error: { code: code || 'UNKNOWN_ERROR' }, meta: meta || {} };
}
