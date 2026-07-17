import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';

let root = null;
let abortController = null;
let state = { items: [], pagination: { page: 1, pages: 1, total: 0 }, query: '', category: 'ALL', status: 'ALL', pageSize: 25, loading: false };
const CACHE_KEY = 'portal.settings.logs.v1';
const categories = ['ALL','USER_ACTIVITY','AUTHENTICATION','APPLICATION','AUDIT','ERRORS','SYSTEM'];

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function readCache() { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; } }
function writeCache(value) { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* optional */ } }
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
}
function categoryLabel(value) {
  return ({ ALL:'Semua', USER_ACTIVITY:'User Activity', AUTHENTICATION:'Authentication', APPLICATION:'Application', AUDIT:'Audit', ERRORS:'Errors', SYSTEM:'System' })[value] || value;
}
function statusClass(value) {
  const status = String(value || '').toUpperCase();
  if (status === 'SUCCESS' || status === 'INFO') return 'bg-emerald-50 text-emerald-700';
  if (status === 'FAILED' || status === 'ERROR') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-700';
}
function render() {
  if (!root) return;
  const p = state.pagination || { page: 1, pages: 1, total: 0 };
  root.innerHTML = `
    <section class="space-y-4">
      <div class="app-card grid gap-3 lg:grid-cols-[1fr_190px_150px_auto]">
        <input data-log-query value="${escapeHtml(state.query)}" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500" placeholder="Cari aksi, user, app, request ID...">
        <select data-log-category class="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">${categories.map(x => `<option value="${x}" ${state.category === x ? 'selected' : ''}>${categoryLabel(x)}</option>`).join('')}</select>
        <select data-log-status class="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
          ${['ALL','SUCCESS','FAILED','INFO','ERROR'].map(x => `<option value="${x}" ${state.status === x ? 'selected' : ''}>${x === 'ALL' ? 'Semua status' : x}</option>`).join('')}
        </select>
        <button type="button" data-log-refresh class="app-button-secondary">Refresh</button>
      </div>
      <div class="app-card overflow-hidden p-0">
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              <th class="px-4 py-3">Waktu</th><th class="px-4 py-3">Kategori</th><th class="px-4 py-3">Aktivitas</th><th class="px-4 py-3">User / App</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Request ID</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-100">
              ${state.loading && !state.items.length ? `<tr><td colspan="6" class="px-4 py-10 text-center text-slate-500">Memuat log...</td></tr>` : state.items.map(item => `<tr class="align-top hover:bg-slate-50">
                <td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">${escapeHtml(formatDate(item.timestamp))}</td>
                <td class="px-4 py-3"><span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">${escapeHtml(categoryLabel(item.category))}</span></td>
                <td class="max-w-[360px] px-4 py-3"><div class="font-semibold text-slate-900">${escapeHtml(item.action || item.message)}</div><div class="mt-1 truncate text-xs text-slate-500" title="${escapeHtml(item.message)}">${escapeHtml(item.message)}</div></td>
                <td class="px-4 py-3 text-xs text-slate-600"><div>${escapeHtml(item.userId || '-')}</div><div class="mt-1 text-slate-400">${escapeHtml(item.appId || '-')}</div></td>
                <td class="px-4 py-3"><span class="rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                <td class="max-w-[180px] px-4 py-3 font-mono text-[11px] text-slate-500"><span title="${escapeHtml(item.requestId)}">${escapeHtml(item.requestId || '-')}</span></td>
              </tr>`).join('') || `<tr><td colspan="6" class="px-4 py-10 text-center text-slate-500">Belum ada log yang sesuai.</td></tr>`}
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>${Number(p.total || 0)} log · Halaman ${Number(p.page || 1)}/${Number(p.pages || 1)}</span>
          <div class="flex gap-2"><button data-log-prev class="app-button-secondary" ${p.page <= 1 ? 'disabled' : ''}>Sebelumnya</button><button data-log-next class="app-button-secondary" ${p.page >= p.pages ? 'disabled' : ''}>Berikutnya</button></div>
        </footer>
      </div>
    </section>`;
  bind();
}

async function load({ background = false } = {}) {
  if (!background) { state.loading = true; render(); }
  try {
    const result = await callApi('logs.list', { page: state.pagination.page || 1, pageSize: state.pageSize, query: state.query, category: state.category, status: state.status }, { deduplicate: false });
    state.items = result.data?.items || [];
    state.pagination = result.data?.pagination || { page: 1, pages: 1, total: 0 };
    writeCache({ items: state.items, pagination: state.pagination, savedAt: Date.now() });
  } catch (error) {
    if (!background) toast.error(error.message || 'Log gagal dimuat.');
  } finally {
    state.loading = false;
    render();
  }
}

function bind() {
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;
  root.querySelector('[data-log-query]')?.addEventListener('change', (e) => { state.query = e.target.value; state.pagination.page = 1; load(); }, { signal });
  root.querySelector('[data-log-category]')?.addEventListener('change', (e) => { state.category = e.target.value; state.pagination.page = 1; load(); }, { signal });
  root.querySelector('[data-log-status]')?.addEventListener('change', (e) => { state.status = e.target.value; state.pagination.page = 1; load(); }, { signal });
  root.querySelector('[data-log-refresh]')?.addEventListener('click', () => load(), { signal });
  root.querySelector('[data-log-prev]')?.addEventListener('click', () => { state.pagination.page -= 1; load(); }, { signal });
  root.querySelector('[data-log-next]')?.addEventListener('click', () => { state.pagination.page += 1; load(); }, { signal });
}

export async function mount(container) {
  root = container;
  const cached = readCache();
  if (cached?.items) {
    state.items = cached.items;
    state.pagination = cached.pagination || state.pagination;
    render();
    await load({ background: true });
  } else {
    await load();
  }
}
