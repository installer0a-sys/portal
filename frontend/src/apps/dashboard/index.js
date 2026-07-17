import { defineApp } from '../../sdk/portal-sdk.js';

const FAVORITES_KEY = 'portal.favoriteApps.v1';
const RECENTS_KEY = 'portal.recentApps.v1';
let mountedContainer = null;
let contextRef = null;
let searchQuery = '';

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function readList(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
function writeList(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getApps() { return (contextRef?.visibleManifests || []).filter((item) => item.id !== 'dashboard'); }
function appInitial(app) { return String(app.shortTitle || app.title || app.id).slice(0,2).toUpperCase(); }
function renderCard(app, favorites) {
  const favorite = favorites.includes(app.id);
  return `<article class="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg">
    <button type="button" data-favorite-app="${escapeHtml(app.id)}" class="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-lg transition hover:bg-amber-50" aria-label="${favorite ? 'Hapus dari favorit' : 'Tambahkan ke favorit'}">${favorite ? '★' : '☆'}</button>
    <button type="button" data-open-app="${escapeHtml(app.route)}" data-app-id="${escapeHtml(app.id)}" class="block w-full text-left">
      <div class="pr-10"><div class="flex flex-wrap items-center gap-2"><h4 class="text-lg font-bold text-slate-900 group-hover:text-brand-700">${escapeHtml(app.title)}</h4></div><p class="mt-2 min-h-10 text-sm leading-5 text-slate-500">${escapeHtml(app.description)}</p></div>
      <span class="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-700">Buka aplikasi <span aria-hidden="true">→</span></span>
    </button>
  </article>`;
}
function render() {
  if (!mountedContainer || !contextRef) return;
  const apps = getApps();
  const favorites = readList(FAVORITES_KEY);
  const recents = readList(RECENTS_KEY);
  const keyword = searchQuery.trim().toLowerCase();
  const visible = apps.filter((app) => !keyword || [app.title, app.shortTitle, app.description, ...(app.tags || [])].some((value) => String(value || '').toLowerCase().includes(keyword)));
  const favoriteApps = apps.filter((app) => favorites.includes(app.id));
  const recentApps = recents.map((id) => apps.find((app) => app.id === id)).filter(Boolean).slice(0, 4);
  const username = contextRef.session?.user?.name || contextRef.session?.user?.username || contextRef.session?.profile?.user?.name || 'User';

  mountedContainer.innerHTML = `<section class="launcher-layout space-y-6 lg:flex lg:h-full lg:flex-col lg:space-y-0">
    <div class="launcher-fixed-area space-y-5 lg:shrink-0 lg:pb-5">
      <article class="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-lg sm:p-6">
        <div class="relative max-w-3xl"><p class="text-xs font-semibold text-slate-300">Portal Azko Kudus Sudirman</p><h2 class="mt-1 text-xl font-bold sm:text-2xl">Selamat datang, ${escapeHtml(username)}</h2><p class="mt-2 max-w-2xl text-xs leading-5 text-slate-300 sm:text-sm">Temukan aplikasi kerja dengan cepat. Modul hanya dimuat saat dibutuhkan.</p></div>
      </article>
      <section class="app-card rounded-3xl p-4 sm:p-5">
        <label class="relative block min-w-0"><span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input id="portal-app-search" value="${escapeHtml(searchQuery)}" class="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-50" placeholder="Cari aplikasi atau fungsi..."></label>
      </section>
    </div>
    <div class="launcher-scroll-area space-y-7 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:pb-6">
      ${favoriteApps.length ? `<section><div class="mb-3"><h3 class="text-lg font-bold text-slate-900">Favorit</h3><p class="text-sm text-slate-500">Aplikasi pilihan Anda.</p></div><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${favoriteApps.map((app) => renderCard(app, favorites)).join('')}</div></section>` : ''}
      ${recentApps.length ? `<section><div class="mb-3"><h3 class="text-lg font-bold text-slate-900">Terakhir dibuka</h3><p class="text-sm text-slate-500">Akses kembali aplikasi terbaru.</p></div><div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">${recentApps.map((app) => `<button type="button" data-open-app="${escapeHtml(app.route)}" data-app-id="${escapeHtml(app.id)}" class="app-card text-left transition hover:border-brand-500"><strong class="block truncate text-sm text-slate-900">${escapeHtml(app.title)}</strong></button>`).join('')}</div></section>` : ''}
      <section><div class="mb-3"><h3 class="text-lg font-bold text-slate-900">Semua aplikasi</h3><p class="text-sm text-slate-500">${visible.length} dari ${apps.length} aplikasi ditampilkan.</p></div><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${visible.map((app) => renderCard(app, favorites)).join('') || '<article class="app-card rounded-3xl text-sm text-slate-500">Tidak ada aplikasi yang cocok dengan pencarian.</article>'}</div></section>
    </div>
  </section>`;
  bind();
}

function openApp(button) {
  const id = button.dataset.appId;
  const recents = readList(RECENTS_KEY).filter((item) => item !== id);
  recents.unshift(id);
  writeList(RECENTS_KEY, recents.slice(0, 8));
  contextRef.navigate?.(button.dataset.openApp, { historyMode: 'push' });
}
function bind() {
  mountedContainer.querySelector('#portal-app-search')?.addEventListener('input', (event) => { const cursor = event.target.selectionStart; searchQuery = event.target.value; render(); const input = mountedContainer?.querySelector('#portal-app-search'); input?.focus(); input?.setSelectionRange(cursor, cursor); });
  mountedContainer.querySelectorAll('[data-open-app]').forEach((button) => contextRef.lifecycle?.listen(button, 'click', () => openApp(button)));
  mountedContainer.querySelectorAll('[data-favorite-app]').forEach((button) => contextRef.lifecycle?.listen(button, 'click', () => {
    const favorites = readList(FAVORITES_KEY);
    const id = button.dataset.favoriteApp;
    writeList(FAVORITES_KEY, favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]);
    render();
  }));
}
const dashboardApp = defineApp({
  id: 'dashboard',
  async mount(container, context = {}) { mountedContainer = container; contextRef = context; render(); context.lifecycle?.addCleanup(() => { mountedContainer = null; contextRef = null; }); },
  async refresh() { render(); }, async pause() {}, async resume() {},
  async unmount() { if (mountedContainer) mountedContainer.innerHTML = ''; mountedContainer = null; contextRef = null; }
});
export const { mount, refresh, pause, resume, unmount } = dashboardApp;
