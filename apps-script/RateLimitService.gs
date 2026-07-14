function assertLoginRateLimit_(username) {
  const cache = CacheService.getScriptCache();
  const key = 'login:' + normalizeUsername_(username);
  const attempts = Number(cache.get(key) || 0);
  if (attempts >= 5) {
    const error = new Error('Terlalu banyak percobaan login. Coba kembali beberapa menit lagi.');
    error.code = 'RATE_LIMITED';
    throw error;
  }
}

function recordLoginFailure_(username) {
  const cache = CacheService.getScriptCache();
  const key = 'login:' + normalizeUsername_(username);
  const attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), 600);
}

function clearLoginFailures_(username) {
  CacheService.getScriptCache().remove('login:' + normalizeUsername_(username));
}
