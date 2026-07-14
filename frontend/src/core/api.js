import { CONFIG } from './config.js';
import { store } from './store.js';
import { logger } from './logger.js';
import { sessionStore } from './session.js';

const pending = new Map();

function createRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createKey(action, payload) {
  return `${action}:${JSON.stringify(payload || {})}`;
}

async function execute(action, payload = {}, options = {}) {
  const timeoutMs = options.timeoutMs || CONFIG.requestTimeoutMs || 30000;
  const requestId = createRequestId();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  store.setState({ pendingRequests: store.getState().pendingRequests + 1 });
  const startedAt = performance.now();

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        requestId,
        action,
        payload,
        sessionToken: options.anonymous ? '' : sessionStore.getToken()
      }),
      signal: controller.signal,
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const durationMs = Math.round(performance.now() - startedAt);

    logger.info('API request completed', { action, requestId, durationMs, ok: result.ok });

    if (!result.ok) {
      const error = new Error(result.message || 'Permintaan server gagal.');
      error.code = result.error && result.error.code ? result.error.code : 'API_ERROR';
      throw error;
    }
    return result;
  } catch (error) {
    const message = error.name === 'AbortError'
      ? `Request timeout setelah ${timeoutMs} ms`
      : error.message;

    store.setState({
      lastError: { action, requestId, message, code: error.code || '', timestamp: new Date().toISOString() }
    });
    logger.error('API request failed', { action, requestId, message, code: error.code || '' });
    const wrapped = new Error(message);
    wrapped.code = error.code || '';
    throw wrapped;
  } finally {
    window.clearTimeout(timer);
    store.setState({ pendingRequests: Math.max(0, store.getState().pendingRequests - 1) });
  }
}

export function callApi(action, payload = {}, options = {}) {
  const key = createKey(action, payload);
  if (options.deduplicate !== false && pending.has(key)) return pending.get(key);
  const request = execute(action, payload, options).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function getPendingRequestCount() {
  return pending.size;
}
