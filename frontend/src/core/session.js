const TOKEN_KEY = 'portal.session.token';
const AUTH_SNAPSHOT_KEY = 'portal.auth.snapshot.v1';

function readJson(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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
    return readJson(AUTH_SNAPSHOT_KEY);
  },

  setAuthSnapshot(snapshot) {
    if (!snapshot) {
      sessionStorage.removeItem(AUTH_SNAPSHOT_KEY);
      return;
    }
    sessionStorage.setItem(
      AUTH_SNAPSHOT_KEY,
      JSON.stringify({ ...snapshot, savedAt: Date.now() })
    );
  },

  clearAuthSnapshot() {
    sessionStorage.removeItem(AUTH_SNAPSHOT_KEY);
  },

  setSession(token, profile) {
    this.setToken(token);
    this.setAuthSnapshot(profile);
  },

  getProfile() {
    return this.getAuthSnapshot();
  },

  updateProfile(profile) {
    this.setAuthSnapshot(profile);
  },

  clearRuntimeSession() {
    this.clearToken();
    this.clearAuthSnapshot();
  }
};
