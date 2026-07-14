import { CONFIG } from './config.js';

const pending = new Map();

export async function callApi(action, payload = {}) {
  if (CONFIG.apiUrl.includes('PASTE_')) {
    return { ok: true, data: { demo: true, action }, message: 'Mode demo: API belum dikonfigurasi.' };
  }

  const key = `${action}:${JSON.stringify(payload)}`;
  if (pending.has(key)) return pending.get(key);

  const request = execute(action, payload).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

async function execute(action, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, requestId: crypto.randomUUID() }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'API gagal.');
    return result;
  } finally {
    clearTimeout(timer);
  }
}
