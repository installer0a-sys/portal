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

function sendLogoutInBackground(token) {
  if (!token) return;

  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `logout_${Date.now()}`;

  fetch(window.PORTAL_API_URL || '', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      requestId,
      action: 'auth.logout',
      payload: {},
      sessionToken: token
    }),
    redirect: 'follow',
    keepalive: true
  }).catch(() => {});
}

export const auth = {
  async login(username, password) {
    const result = await callApi('auth.login', { username, password }, {
      anonymous: true,
      deduplicate: false,
      timeoutMs: 30000
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
    const token = sessionStore.getToken();

    // UI dan permission dibersihkan langsung agar logout terasa instan.
    sessionStore.clearRuntimeSession();
    applyProfile(null);

    if (token) {
      try {
        await callApi('auth.logout', {}, {
          deduplicate: false,
          timeoutMs: 8000,
          sessionTokenOverride: token
        });
      } catch (error) {
        // User tetap dianggap logout di perangkat ini.
      }
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
