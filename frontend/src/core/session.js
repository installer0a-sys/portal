const TOKEN_KEY = 'portal.session.token';
const PROFILE_KEY = 'portal.session.profile';

export const sessionStore = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  },

  setSession(token, profile) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile || null));
  },

  getProfile() {
    try {
      return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null');
    } catch (error) {
      return null;
    }
  },

  updateProfile(profile) {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile || null));
  },

  clearRuntimeSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  }
};
