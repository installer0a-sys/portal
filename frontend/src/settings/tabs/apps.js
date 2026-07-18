import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';

let containerRef = null;
let apps = [];
let query = '';
let includeDeleted = false;
let includeInactive = true;
let abortController = null;
const CACHE_KEY = 'portal.settings.apps.v2';
const SHARED_CATALOG_CACHE_KEY = 'portal.appCatalog.v1';
let memoryCache = null;
let refreshPromise = null;
function readCache() {
  if (memoryCache) return memoryCache;
  try { memoryCache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { memoryCache = null; }
  return memoryCache;
}
function writeCache(value) {
  memoryCache = value;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    localStorage.setItem(
      SHARED_CATALOG_CACHE_KEY,
      JSON.stringify(value)
    );
  } catch {
    // Cache is optional.
  }
}

function publishRegistryChange() {
  window.dispatchEvent(
    new CustomEvent('portal:app-registry-changed')
  );
}


function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function filteredApps() {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return apps;
  return apps.filter((app) => [app.appId, app.appName, app.description, app.category].some((value) => String(value || '').toLowerCase().includes(keyword)));
}

function render() {
  if (!containerRef) return;
  const records = filteredApps();
  containerRef.innerHTML = `
    <section class="space-y-4">
      <div class="app-card flex flex-col gap-3 xl:flex-row xl:items-center">
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Cari aplikasi</span>
          <input data-app-search value="${escapeHtml(query)}" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Cari nama, App ID, kategori...">
        </label>
        <div class="flex flex-wrap gap-2">
          <label class="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><input data-include-inactive type="checkbox" ${includeInactive ? 'checked' : ''}> Nonaktif</label>
          <label class="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><input data-include-deleted type="checkbox" ${includeDeleted ? 'checked' : ''}> Terhapus</label>
          <button type="button" data-app-refresh class="app-button-secondary">Refresh</button>
          <button type="button" data-app-create class="app-button-primary">+ Tambah App</button>
        </div>
      </div>

      <div class="grid gap-3">
        ${records.map((app, index) => `
          <article class="app-card p-0 overflow-hidden">
            <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 font-bold text-blue-700">${escapeHtml(app.appName || app.appId).slice(0,2).toUpperCase()}</div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="truncate font-bold text-slate-900">${escapeHtml(app.appName)}</h4>
                  <span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${app.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : app.status === 'DELETED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(app.status)}</span>
                  <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">${escapeHtml(app.appId)}</span>
                </div>
                <p class="mt-1 line-clamp-2 text-sm text-slate-500">${escapeHtml(app.description || 'Belum ada deskripsi.')}</p>
                <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Kategori: ${escapeHtml(app.category || '-')}</span>
                  <span>Route: /${escapeHtml(app.routeSlug || app.appId)}</span><span>Config: ${escapeHtml(app.configSheet || 'CONFIG_WEB')}</span>
                  <span>Sync: ${escapeHtml(formatDate(app.configSyncedAt))}</span>
                </div>
              </div>
              <div class="flex flex-wrap gap-2 sm:justify-end">
                <button type="button" data-app-move="UP" data-app-id="${escapeHtml(app.appId)}" class="app-button-secondary min-h-9 px-3" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" data-app-move="DOWN" data-app-id="${escapeHtml(app.appId)}" class="app-button-secondary min-h-9 px-3" ${index === records.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" data-app-connect data-app-id="${escapeHtml(app.appId)}" class="app-button-secondary min-h-9 px-3">Tes</button>
                <button type="button" data-app-sync data-app-id="${escapeHtml(app.appId)}" class="app-button-secondary min-h-9 px-3">Sync</button>
                <button type="button" data-app-edit data-app-id="${escapeHtml(app.appId)}" class="app-button-secondary min-h-9 px-3">Edit</button>
                ${app.status === 'DELETED'
                  ? `<button type="button" data-app-restore data-app-id="${escapeHtml(app.appId)}" class="app-button-primary min-h-9 px-3">Restore</button>`
                  : `<button type="button" data-app-delete data-app-id="${escapeHtml(app.appId)}" class="app-button-secondary min-h-9 px-3 text-red-600">Hapus</button>`}
              </div>
            </div>
          </article>`).join('') || '<div class="app-card text-sm text-slate-500">Aplikasi tidak ditemukan.</div>'}
      </div>
    </section>`;
  bind();
}

function formTemplate(app = {}) {
  return `
    <form data-app-form class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-semibold text-slate-700">App ID<input name="appId" ${app.appId ? 'readonly' : ''} value="${escapeHtml(app.appId || '')}" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
        <label class="text-sm font-semibold text-slate-700">Nama aplikasi<input name="appName" value="${escapeHtml(app.appName || '')}" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
        <label class="text-sm font-semibold text-slate-700 sm:col-span-2">Deskripsi<textarea name="description" rows="3" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500">${escapeHtml(app.description || '')}</textarea></label>
        <label class="text-sm font-semibold text-slate-700 sm:col-span-2">Spreadsheet ID<input name="spreadsheetId" value="${escapeHtml(app.spreadsheetId || '')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-xs font-normal outline-none focus:border-blue-500"></label>
        <label class="text-sm font-semibold text-slate-700">Sheet config<input name="configSheet" value="${escapeHtml(app.configSheet || 'CONFIG_WEB')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
        <label class="text-sm font-semibold text-slate-700">Route / slug<input name="routeSlug" value="${escapeHtml(app.routeSlug || app.appId || '')}" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-slate-500"></label><label class="text-sm font-semibold text-slate-700">Kategori<input name="category" value="${escapeHtml(app.category || '')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
        <label class="text-sm font-semibold text-slate-700 sm:col-span-2">URL web mandiri<input name="standaloneUrl" value="${escapeHtml(app.standaloneUrl || '')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
        <label class="text-sm font-semibold text-slate-700">Cache TTL (detik)<input name="cacheTtlSeconds" type="number" min="10" max="21600" value="${Number(app.cacheTtlSeconds || 900)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
        <label class="text-sm font-semibold text-slate-700">Status<select name="status" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"><option value="ACTIVE" ${app.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE</option><option value="INACTIVE" ${app.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option></select></label>
      </div>
      <div class="flex justify-end gap-2"><button type="button" data-form-cancel class="app-button-secondary">Batal</button><button type="submit" class="app-button-primary">Simpan</button></div>
    </form>`;
}

async function openForm(app = null) {
  const host = document.createElement('div');
  host.className = 'fixed inset-0 z-[140] grid place-items-center bg-slate-950/50 p-4';
  host.innerHTML = `<section class="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl"><div class="mb-4"><h3 class="text-lg font-bold text-slate-900">${app ? 'Edit aplikasi' : 'Tambah aplikasi'}</h3><p class="text-sm text-slate-500">Data utama aplikasi tetap berada di Spreadsheet masing-masing.</p></div>${formTemplate(app || {})}</section>`;
  document.body.appendChild(host);
  host.querySelector('[data-form-cancel]').addEventListener('click', () => host.remove());
  host.addEventListener('click', (event) => { if (event.target === host) host.remove(); });
  host.querySelector('[data-app-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    values.cacheTtlSeconds = Number(values.cacheTtlSeconds || 900);
    try {
      if (app) await callApi('apps.update', { appId: app.appId, values });
      else await callApi('apps.create', values);
      toast.success(app ? 'Aplikasi diperbarui.' : 'Aplikasi ditambahkan.');
      host.remove();
      await load({ force: true });
      publishRegistryChange();
    } catch (error) { toast.error(error.message); }
  });
}

async function load({ background = false, force = false } = {}) {
  if (!containerRef) return;
  if (refreshPromise && !force) return refreshPromise;
  const hasVisibleData = apps.length > 0;
  if (!background && !hasVisibleData) {
    containerRef.innerHTML = '<div class="app-card animate-pulse text-sm text-slate-500">Memuat registry aplikasi...</div>';
  }
  refreshPromise = (async () => {
    try {
      const result = await callApi('apps.list', { includeDeleted, includeInactive }, { deduplicate: false });
      apps = result.data?.apps || [];
      writeCache({ apps, savedAt: Date.now() });
      publishRegistryChange();
      if (containerRef) render();
    } catch (error) {
      if (!hasVisibleData && containerRef) {
        containerRef.innerHTML = `<div class="app-card border-red-200 bg-red-50 text-sm text-red-700">${escapeHtml(error.message)}</div>`;
      }
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function action(actionName, payload, success) {
  try {
    await callApi(actionName, payload, { deduplicate: false });
    toast.success(success);
    await load({ force: true });
    publishRegistryChange();
  } catch (error) {
    toast.error(error.message);
  }
}

function bind() {
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;
  containerRef.querySelector('[data-app-search]')?.addEventListener('input', (event) => { const cursor = event.target.selectionStart; query = event.target.value; render(); const input = containerRef?.querySelector('[data-app-search]'); input?.focus(); input?.setSelectionRange(cursor, cursor); }, { signal });
  containerRef.querySelector('[data-include-inactive]')?.addEventListener('change', async (event) => { includeInactive = event.target.checked; await load(); }, { signal });
  containerRef.querySelector('[data-include-deleted]')?.addEventListener('change', async (event) => { includeDeleted = event.target.checked; await load(); }, { signal });
  containerRef.querySelector('[data-app-refresh]')?.addEventListener('click', () => load({ force: true }), { signal });
  containerRef.querySelector('[data-app-create]')?.addEventListener('click', () => openForm(), { signal });
  containerRef.querySelectorAll('[data-app-edit]').forEach((button) => button.addEventListener('click', () => openForm(apps.find((app) => app.appId === button.dataset.appId)), { signal }));
  containerRef.querySelectorAll('[data-app-move]').forEach((button) => button.addEventListener('click', () => action('apps.move', { appId: button.dataset.appId, direction: button.dataset.appMove }, 'Posisi diperbarui.'), { signal }));
  containerRef.querySelectorAll('[data-app-connect]').forEach((button) => button.addEventListener('click', async () => {
    try { const result = await callApi('apps.validateConnection', { appId: button.dataset.appId }, { deduplicate: false }); toast.success(`${result.data?.spreadsheetName || 'Spreadsheet'}: ${result.message}`); }
    catch (error) { toast.error(error.message); }
  }, { signal }));
  containerRef.querySelectorAll('[data-app-sync]').forEach((button) => button.addEventListener('click', () => action('apps.syncConfig', { appId: button.dataset.appId }, 'CONFIG_WEB berhasil disinkronkan.'), { signal }));
  containerRef.querySelectorAll('[data-app-delete]').forEach((button) => button.addEventListener('click', () => {
    if (confirm('Hapus aplikasi dari katalog? Spreadsheet sumber tidak akan dihapus.')) action('apps.delete', { appId: button.dataset.appId }, 'Aplikasi dihapus dari katalog.');
  }, { signal }));
  containerRef.querySelectorAll('[data-app-restore]').forEach((button) => button.addEventListener('click', () => action('apps.restore', { appId: button.dataset.appId }, 'Aplikasi dipulihkan.'), { signal }));
}

export async function mount(container) {
  containerRef = container;
  const cached = readCache();
  if (cached?.apps) {
    apps = cached.apps;
    render();
    void load({ background: true });
    return;
  }
  await load();
}
