import { callApi } from '../core/api.js';
import { sessionStore } from '../core/session.js';
import { store } from '../core/store.js';
import { logger } from '../core/logger.js';

const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

function buildSnapshot(data) {
  return {
    user: data.user || null,
    access: data.access || {},
    permissionSignature: data.permissionSignature || '',
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
    {
      username,
      password
    },
    {
      anonymous: true,
      deduplicate: false
    }
  );

  const token = result.data?.sessionToken || '';

  if (!token) {
    throw new Error('Session token tidak ditemukan.');
  }

  const snapshot = buildSnapshot(result.data);

  sessionStore.setToken(token);
  sessionStore.setAuthSnapshot(snapshot);

  applyAuthenticatedState(snapshot);

  logger.info('Login successful', {
    username: snapshot.user?.username || ''
  });

  return {
    authenticated: true,
    source: 'login',
    ...snapshot
  };
}

export async function restoreSession({
  forceValidation = false
} = {}) {
  const token = sessionStore.getToken();
  const cached = sessionStore.getAuthSnapshot();

  if (!token) {
    applyLoggedOutState();

    return {
      authenticated: false,
      source: 'none'
    };
  }

  if (cached) {
    const referenceTime = Number(
      cached.validatedAt ||
      cached.savedAt ||
      0
    );

    const age = Date.now() - referenceTime;

    if (
      !forceValidation &&
      age >= 0 &&
      age < SESSION_REVALIDATE_MS
    ) {
      applyAuthenticatedState(cached);

      return {
        authenticated: true,
        source: 'cache',
        ...cached
      };
    }
  }

  try {
    const result = await callApi(
      'auth.session',
      {},
      {
        deduplicate: true
      }
    );

    const snapshot = buildSnapshot(result.data);

    sessionStore.setAuthSnapshot(snapshot);
    applyAuthenticatedState(snapshot);

    return {
      authenticated: true,
      source: 'server',
      ...snapshot
    };
  } catch (error) {
    sessionStore.clearRuntimeSession();
    applyLoggedOutState();

    logger.warn('Session restore failed', {
      message: error.message
    });

    return {
      authenticated: false,
      source: 'server',
      error: error.message
    };
  }
}

export async function logout() {
  const token = sessionStore.getToken();

  sessionStore.clearRuntimeSession();
  applyLoggedOutState();

  if (!token) {
    return;
  }

  callApi(
    'auth.logout',
    {},
    {
      sessionTokenOverride: token,
      deduplicate: false
    }
  ).catch((error) => {
    logger.warn('Server logout failed', {
      message: error.message
    });
  });
}
export const auth = {
  login,
  restoreSession,
  logout
};
