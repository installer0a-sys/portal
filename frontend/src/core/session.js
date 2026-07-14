const TOKEN_KEY = 'portal.session.token';
const AUTH_SNAPSHOT_KEY = 'portal.auth.snapshot.v1';

export const sessionStore = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  },

  setToken(token) {
    if (!token) {
      sessionStorage.removeItem(TOKEN_KEY);
      return;
    }

    sessionStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  },

  getAuthSnapshot() {
    try {
      const raw = sessionStorage.getItem(AUTH_SNAPSHOT_KEY);

      if (!raw) return null;

      const snapshot = JSON.parse(raw);

      if (
        !snapshot ||
        !snapshot.user ||
        !snapshot.savedAt
      ) {
        return null;
      }

      return snapshot;
    } catch {
      return null;
    }
  },

  setAuthSnapshot(snapshot) {
    if (!snapshot) {
      sessionStorage.removeItem(AUTH_SNAPSHOT_KEY);
      return;
    }

    sessionStorage.setItem(
      AUTH_SNAPSHOT_KEY,
      JSON.stringify({
        ...snapshot,
        savedAt: Date.now()
      })
    );
  },

  clearAuthSnapshot() {
    sessionStorage.removeItem(AUTH_SNAPSHOT_KEY);
  },

  clearRuntimeSession() {
    this.clearToken();
    this.clearAuthSnapshot();
  }
};
