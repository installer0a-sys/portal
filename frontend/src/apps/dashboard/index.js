import { defineApp } from '../../sdk/portal-sdk.js';

const FAVORITES_KEY = 'portal.favoriteApps.v1';
const RECENTS_KEY = 'portal.recentApps.v1';
let mountedContainer = null;
let contextRef = null;
let searchQuery = '';
let selectedCategory = 'Semua';

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
  return `<article class="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg">
    <button type="button" data-favorite-app="${escapeHtml(app.id)}" class="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-lg transition hover:bg-amber-50" aria-label="${favorite ? 'Hapus dari favorit' : 'Tambahkan ke favorit'}">${favorite ? '★' : '☆'}</button>
    <button type="button" data-open-app="${escapeHtml(app.route)}" data-app-id="${escapeHtml(app.id)}" class="block w-full text-left">
      <span class="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 font-bold text-blue-700">${escapeHtml(appInitial(app))}</span>
      <div class="mt-5 pr-10"><div class="flex flex-wrap items-center gap-2"><h4 class="text-lg font-bold text-slate-900 group-hover:text-blue-700">${escapeHtml(app.title)}</h4><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">${escapeHtml(app.category || 'Aplikasi')}</span></div><p class="mt-2 min-h-10 text-sm leading-5 text-slate-500">${escapeHtml(app.description)}</p></div>
      <span class="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700">Buka aplikasi <span aria-hidden="true">→</span></span>
    </button>
  </article>`;
}
function render() {
  if (!mountedContainer || !contextRef) return;
  const apps = getApps();
  const favorites = readList(FAVORITES_KEY);
  const recents = readList(RECENTS_KEY);
  const categories = ['Semua', ...new Set(apps.map((app) => app.category || 'Lainnya'))];
  const keyword = searchQuery.trim().toLowerCase();
  const visible = apps.filter((app) => {
    const categoryMatch = selectedCategory === 'Semua' || (app.category || 'Lainnya') === selectedCategory;
    const searchMatch = !keyword || [app.title, app.shortTitle, app.description, app.category, ...(app.tags || [])].some((value) => String(value || '').toLowerCase().includes(keyword));
    return categoryMatch && searchMatch;
  });
  const favoriteApps = apps.filter((app) => favorites.includes(app.id));
  const recentApps = recents.map((id) => apps.find((app) => app.id === id)).filter(Boolean).slice(0, 4);
  const username = contextRef.session?.user?.name || contextRef.session?.user?.username || contextRef.session?.profile?.user?.name || 'User';

  mountedContainer.innerHTML = `<section class="space-y-7">
    <article class="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl sm:p-8">
      <div class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl"></div>
      <div class="relative max-w-3xl"><p class="text-sm font-semibold text-blue-300">Portal Azko Kudus Sudirman</p><h2 class="mt-2 text-2xl font-bold sm:text-4xl">Selamat datang, ${escapeHtml(username)}</h2><p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Temukan aplikasi kerja Anda dengan cepat. Modul dimuat hanya saat dibutuhkan agar login dan perpindahan tetap ringan.</p></div>
    </article>

    <section class="app-card rounded-3xl p-4 sm:p-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label class="relative min-w-0 flex-1"><span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input id="portal-app-search" value="${escapeHtml(searchQuery)}" class="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Cari aplikasi, kategori, atau fungsi..."></label>
        <div class="flex gap-2 overflow-x-auto pb-1 lg:max-w-[52%]">${categories.map((category) => `<button type="button" data-category="${escapeHtml(category)}" class="min-w-max rounded-xl px-3 py-2 text-sm font-semibold transition ${selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${escapeHtml(category)}</button>`).join('')}</div>
      </div>
    </section>

    ${favoriteApps.length ? `<section><div class="mb-3 flex items-end justify-between"><div><h3 class="text-lg font-bold text-slate-900">Favorit</h3><p class="text-sm text-slate-500">Aplikasi pilihan Anda.</p></div></div><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${favoriteApps.map((app) => renderCard(app, favorites)).join('')}</div></section>` : ''}
    ${recentApps.length ? `<section><div class="mb-3"><h3 class="text-lg font-bold text-slate-900">Terakhir dibuka</h3><p class="text-sm text-slate-500">Akses kembali aplikasi terbaru.</p></div><div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">${recentApps.map((app) => `<button type="button" data-open-app="${escapeHtml(app.route)}" data-app-id="${escapeHtml(app.id)}" class="app-card flex items-center gap-3 text-left transition hover:border-blue-300"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-xs font-bold text-blue-700">${escapeHtml(appInitial(app))}</span><span class="min-w-0"><strong class="block truncate text-sm text-slate-900">${escapeHtml(app.title)}</strong><span class="block truncate text-xs text-slate-500">${escapeHtml(app.category || 'Aplikasi')}</span></span></button>`).join('')}</div></section>` : ''}

    <section><div class="mb-3 flex items-end justify-between gap-4"><div><h3 class="text-lg font-bold text-slate-900">Semua aplikasi</h3><p class="text-sm text-slate-500">${visible.length} dari ${apps.length} aplikasi ditampilkan.</p></div></div><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${visible.map((app) => renderCard(app, favorites)).join('') || '<article class="app-card rounded-3xl text-sm text-slate-500">Tidak ada aplikasi yang cocok dengan pencarian.</article>'}</div></section>
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
  mountedContainer.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => { selectedCategory = button.dataset.category; render(); }));
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
