import { callApi } from '../core/api.js';
import { sessionStore } from '../core/session.js';
import { store } from '../core/store.js';

function applyProfile(profile) {
  sessionStore.updateProfile(profile);
  store.setState({
    user: profile ? profile.user : null,
    permissions: profile && profile.access ? profile.access : {}
  });
  return profile;
}

export const auth = {
  async login(username, password) {
    const result = await callApi('auth.login', { username, password }, {
      anonymous: true,
      deduplicate: false,
      timeoutMs: 45000
    });
    const profile = {
      user: result.data.user,
      access: result.data.access,
      expiresAt: result.data.expiresAt
    };
    sessionStore.setSession(result.data.sessionToken, profile);
    applyProfile(profile);
    return profile;
  },

  async restore() {
    const token = sessionStore.getToken();
    if (!token) return null;
    try {
      const result = await callApi('auth.session', {}, { deduplicate: false });
      return applyProfile(result.data);
    } catch (error) {
      sessionStore.clearRuntimeSession();
      applyProfile(null);
      return null;
    }
  },

  async logout() {
    try {
      if (sessionStore.getToken()) {
        await callApi('auth.logout', {}, { deduplicate: false, timeoutMs: 15000 });
      }
    } finally {
      sessionStore.clearRuntimeSession();
      applyProfile(null);
    }
  },

  getProfile() {
    return sessionStore.getProfile();
  },

  can(permission) {
    const profile = sessionStore.getProfile();
    return Boolean(profile && profile.access && profile.access.permissions.includes(permission));
  }
};
