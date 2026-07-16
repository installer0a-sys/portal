import { CONFIG } from './config.js';
import { sessionStore } from './session.js';
import { store } from './store.js';
import { logger } from './logger.js';

const pending = new Map();

export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN_ERROR', requestId = '', action = '', meta = {}, cause } = {}) {
    super(message || 'Permintaan server gagal.', { cause });
    this.name = 'ApiError';
    this.code = code;
    this.requestId = requestId;
    this.action = action;
    this.meta = meta;
  }
}

function requestId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function execute(action, payload = {}, options = {}) {
  const timeoutMs = Number(options.timeoutMs || CONFIG.requestTimeoutMs || 30000);
  const token = options.sessionTokenOverride !== undefined
    ? String(options.sessionTokenOverride || '')
    : options.anonymous ? '' : sessionStore.getToken();

  const id = requestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  store.setState({ pendingRequests: Number(store.getState().pendingRequests || 0) + 1 });

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ requestId: id, action, payload, sessionToken: token }),
      signal: controller.signal,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, {
        code: 'HTTP_ERROR', requestId: id, action, meta: { status: response.status }
      });
    }

    let result;
    try {
      result = await response.json();
    } catch (cause) {
      throw new ApiError('Respons server bukan JSON yang valid.', {
        code: 'INVALID_RESPONSE', requestId: id, action, cause
      });
    }

    if (!result?.ok) {
      throw new ApiError(result?.message || 'Permintaan server gagal.', {
        code: result?.error?.code || 'API_ERROR',
        requestId: result?.meta?.requestId || id,
        action,
        meta: result?.meta || {}
      });
    }

    logger.info('API request completed', { action, requestId: id });
    return result;
  } catch (error) {
    const normalized = error?.name === 'AbortError'
      ? new ApiError(`Request timeout setelah ${timeoutMs} ms`, { code: 'REQUEST_TIMEOUT', requestId: id, action, cause: error })
      : error instanceof ApiError
        ? error
        : new ApiError(error?.message || 'Koneksi ke server gagal.', { code: 'NETWORK_ERROR', requestId: id, action, cause: error });

    store.setState({
      lastError: {
        action,
        requestId: normalized.requestId || id,
        code: normalized.code,
        message: normalized.message,
        timestamp: new Date().toISOString()
      }
    });

    logger.error('API request failed', {
      action, requestId: normalized.requestId || id, code: normalized.code, message: normalized.message
    });
    throw normalized;
  } finally {
    clearTimeout(timer);
    store.setState({ pendingRequests: Math.max(0, Number(store.getState().pendingRequests || 0) - 1) });
  }
}

export function callApi(action, payload = {}, options = {}) {
  const tokenScope = options.anonymous ? 'anonymous' : sessionStore.getToken().slice(-12);
  const key = `${tokenScope}:${action}:${JSON.stringify(payload || {})}`;
  if (options.deduplicate !== false && pending.has(key)) return pending.get(key);

  const task = execute(action, payload, options).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export function getPendingRequestCount() {
  return pending.size;
}
