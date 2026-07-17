import { callApi } from '../core/api.js';
import { sessionStore } from '../core/session.js';
import { store } from '../core/store.js';
import { logger } from '../core/logger.js';
import { cacheEngine } from '../core/cache.js';

const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

function normalize(data = {}) {
  return {
    user:
      data.user ||
      data.profile?.user ||
      null,
    access:
      data.access ||
      data.profile?.access ||
      {},
    permissionSignature:
      data.permissionSignature ||
      data.profile?.permissionSignature ||
      '',
    validatedAt:
      Date.now()
  };
}

function applyCacheContext(snapshot) {
  cacheEngine.setContext({
    userId:
      snapshot?.user?.userId ||
      snapshot?.user?.id ||
      snapshot?.user?.username ||
      'anonymous',
    permissionSignature:
      snapshot?.permissionSignature ||
      'none',
    sessionVersion:
      snapshot?.user?.sessionVersion ||
      snapshot?.sessionVersion ||
      '0'
  });

  cacheEngine.prune();
}

function applySession(snapshot) {
  store.setState({
    user:
      snapshot.user || null,
    permissions:
      snapshot.access || {},
    lastError:
      null
  });

  applyCacheContext(snapshot);
}

function clearSessionState() {
  store.setState({
    user: null,
    permissions: {},
    route: 'login'
  });

  /*
   * Cache persistent tidak dihapus saat logout.
   * Hanya context runtime yang dikembalikan ke anonymous.
   */
  cacheEngine.clearContext();
}

export async function login(
  username,
  password
) {
  const result =
    await callApi(
      'auth.login',
      {
        username:
          String(username || '').trim(),
        password:
          String(password || '')
      },
      {
        anonymous: true,
        deduplicate: false
      }
    );

  const token =
    String(
      result?.data?.sessionToken ||
      ''
    );

  if (!token) {
    throw new Error(
      'Session token tidak ditemukan.'
    );
  }

  const snapshot =
    normalize(
      result.data || {}
    );

  sessionStore.setToken(token);
  sessionStore.setAuthSnapshot(
    snapshot
  );

  applySession(snapshot);

  logger.info(
    'Login successful',
    {
      username:
        snapshot.user?.username ||
        ''
    }
  );

  return {
    authenticated: true,
    source: 'login',
    ...snapshot
  };
}

export async function restoreSession({
  forceValidation = false
} = {}) {
  const token =
    sessionStore.getToken();

  if (!token) {
    clearSessionState();

    return {
      authenticated: false,
      source: 'none'
    };
  }

  const cached =
    sessionStore.getAuthSnapshot();

  if (
    cached &&
    !forceValidation
  ) {
    const age =
      Date.now() -
      Number(
        cached.validatedAt ||
        cached.savedAt ||
        0
      );

    if (
      age >= 0 &&
      age < SESSION_REVALIDATE_MS
    ) {
      applySession(cached);

      return {
        authenticated: true,
        source: 'cache',
        ...cached
      };
    }
  }

  try {
    const result =
      await callApi(
        'auth.session'
      );

    const snapshot =
      normalize(
        result.data || {}
      );

    sessionStore.setAuthSnapshot(
      snapshot
    );

    applySession(snapshot);

    return {
      authenticated: true,
      source: 'server',
      ...snapshot
    };
  } catch (error) {
    const message = String(error?.message || '');
    const explicitlyInvalid = /(?:session|token).*(?:tidak valid|invalid|expired|kedaluwarsa)|(?:tidak valid|invalid|expired|kedaluwarsa).*(?:session|token)|unauthorized|silakan login|login kembali/i.test(message);

    /*
     * Timeout, koneksi lambat, atau error data aplikasi tidak boleh
     * menghapus sesi Portal yang masih tersimpan. Gunakan snapshot cache
     * sebagai mode offline/stale dan validasi kembali pada request berikutnya.
     */
    if (cached && !explicitlyInvalid) {
      applySession(cached);
      logger.warn('Session validation deferred; cached session retained', { message });
      return {
        authenticated: true,
        source: 'stale-cache',
        stale: true,
        validationError: message,
        ...cached
      };
    }

    sessionStore.clearRuntimeSession();
    clearSessionState();

    logger.warn('Session restore failed', { message });

    return {
      authenticated: false,
      source: 'server',
      error: message
    };
  }
}

export async function logout() {
  const token =
    sessionStore.getToken();

  sessionStore.clearRuntimeSession();
  clearSessionState();

  if (!token) {
    return;
  }

  callApi(
    'auth.logout',
    {},
    {
      sessionTokenOverride:
        token,
      deduplicate:
        false
    }
  ).catch((error) => {
    logger.warn(
      'Server logout failed',
      {
        message:
          error.message
      }
    );
  });
}

export function getProfile() {
  return sessionStore
    .getAuthSnapshot();
}

export function can(permission) {
  const access =
    getProfile()?.access || {};

  const permissions = [
    ...(Array.isArray(
      access.permissions
    )
      ? access.permissions
      : []),
    ...(Array.isArray(
      access.portal?.permissions
    )
      ? access.portal.permissions
      : []),
    ...Object.values(
      access.apps || {}
    ).flatMap((item) =>
      Array.isArray(
        item?.permissions
      )
        ? item.permissions
        : []
    )
  ];

  return permissions.includes(
    permission
  );
}

export const auth = {
  login,
  restore:
    restoreSession,
  restoreSession,
  logout,
  getProfile,
  can
};
