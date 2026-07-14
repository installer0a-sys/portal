import { callApi } from '../core/api.js';
import { sessionStore } from '../core/session.js';
import { store } from '../core/store.js';
import { logger } from '../core/logger.js';

const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

function buildSnapshot(data) {
  return {
    user: data.user || null,
    access: data.access || {},
    permissionSignature:
      data.permissionSignature ||
      data.access?.permissionSignature ||
      '',
    expiresAt: data.expiresAt || '',
    validatedAt: Date.now()
  };
}

function applyAuthenticatedState(snapshot) {
  store.setState({
    user: snapshot.user,
    permissions: snapshot.access || {},
    lastError: null
  });
}

function applyLoggedOutState() {
  store.setState({
    user: null,
    permissions: {},
    route: 'login'
  });
}

export async function login(username, password) {
  const result = await callApi(
    'auth.login',
    { username, password },
    {
      anonymous: true,
      deduplicate: false,
      timeoutMs: 30000
    }
  );

  const token = result.data?.sessionToken || '';
  if (!token) throw new Error('Session token tidak ditemukan.');

  const snapshot = buildSnapshot(result.data || {});
  sessionStore.setSession(token, snapshot);
  applyAuthenticatedState(snapshot);

  logger.info('Login successful', {
    username: snapshot.user?.username || ''
  });

  return snapshot;
}

export async function restoreSession({ forceValidation = false } = {}) {
  const token = sessionStore.getToken();
  const cached = sessionStore.getAuthSnapshot();

  if (!token) {
    applyLoggedOutState();
    return null;
  }

  if (cached) {
    const referenceTime = Number(
      cached.validatedAt || cached.savedAt || 0
    );
    const age = Date.now() - referenceTime;

    if (!forceValidation && age >= 0 && age < SESSION_REVALIDATE_MS) {
      applyAuthenticatedState(cached);
      logger.info('Session restored from cache', {
        username: cached.user?.username || ''
      });
      return cached;
    }
  }

  try {
    const result = await callApi('auth.session', {}, { deduplicate: true });
    const snapshot = buildSnapshot(result.data || {});
    sessionStore.setAuthSnapshot(snapshot);
    applyAuthenticatedState(snapshot);
    return snapshot;
  } catch (error) {
    sessionStore.clearRuntimeSession();
    applyLoggedOutState();
    logger.warn('Session restore failed', { message: error.message });
    return null;
  }
}

export async function logout() {
  const token = sessionStore.getToken();

  sessionStore.clearRuntimeSession();
  applyLoggedOutState();

  if (!token) return;

  callApi(
    'auth.logout',
    {},
    {
      sessionTokenOverride: token,
      deduplicate: false,
      timeoutMs: 8000
    }
  ).catch((error) => {
    logger.warn('Server logout failed', { message: error.message });
  });
}

export function getProfile() {
  return sessionStore.getProfile();
}

export function can(permission) {
  const permissions = getProfile()?.access?.permissions || [];
  return permissions.includes(permission);
}

export const auth = {
  login,
  restore: restoreSession,
  restoreSession,
  logout,
  getProfile,
  can
};
