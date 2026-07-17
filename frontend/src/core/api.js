import { CONFIG } from './config.js';
import { sessionStore } from './session.js';
import { store } from './store.js';
import { logger } from './logger.js';

const pending = new Map();

function requestId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function execute(action, payload = {}, options = {}) {
  const timeoutMs = Number(options.timeoutMs || CONFIG.requestTimeoutMs || 30000);
  const token = options.sessionTokenOverride !== undefined
    ? String(options.sessionTokenOverride || '')
    : options.anonymous
      ? ''
      : sessionStore.getToken();

  const id = requestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  store.setState({
    pendingRequests: Number(store.getState().pendingRequests || 0) + 1
  });

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        requestId: id,
        action,
        payload,
        sessionToken: token
      }),
      signal: controller.signal,
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (!result?.ok) {
      throw new Error(result?.message || 'Permintaan server gagal.');
    }

    logger.info('API request completed', { action, requestId: id });
    return result;
  } catch (error) {
    const message = error.name === 'AbortError'
      ? `Request timeout setelah ${timeoutMs} ms`
      : error.message;

    const expectedPermissionFailure = /tidak memiliki izin|akses ditolak|permission denied|forbidden/i.test(message);

    if (!expectedPermissionFailure) {
      store.setState({
        lastError: {
          action,
          requestId: id,
          message,
          timestamp: new Date().toISOString()
        }
      });
      logger.error('API request failed', { action, requestId: id, message });
    } else {
      logger.warn('API permission denied', { action, requestId: id, message });
    }

    const normalizedError = new Error(message);
    normalizedError.code = expectedPermissionFailure ? 'PERMISSION_DENIED' : 'API_REQUEST_FAILED';
    throw normalizedError;
  } finally {
    clearTimeout(timer);
    store.setState({
      pendingRequests: Math.max(
        0,
        Number(store.getState().pendingRequests || 0) - 1
      )
    });
  }
}

export function callApi(action, payload = {}, options = {}) {
  const key = `${action}:${JSON.stringify(payload || {})}`;
  if (options.deduplicate !== false && pending.has(key)) {
    return pending.get(key);
  }

  const task = execute(action, payload, options).finally(() => {
    pending.delete(key);
  });

  pending.set(key, task);
  return task;
}

export function getPendingRequestCount() {
  return pending.size;
}
