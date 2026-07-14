const TOKEN_KEY = 'portal.session.token';
const SNAPSHOT_KEY = 'portal.auth.snapshot.v1';

export const sessionStore = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  },
  setToken(token) {
    const value = String(token || '');
    if (!value) {
      sessionStorage.removeItem(TOKEN_KEY);
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, value);
  },
  clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  },
  getAuthSnapshot() {
    try {
      const raw = sessionStorage.getItem(SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setAuthSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      sessionStorage.removeItem(SNAPSHOT_KEY);
      return;
    }
    sessionStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ ...snapshot, savedAt: Date.now() })
    );
  },
  clearAuthSnapshot() {
    sessionStorage.removeItem(SNAPSHOT_KEY);
  },
  clearRuntimeSession() {
    this.clearToken();
    this.clearAuthSnapshot();
  }
};
