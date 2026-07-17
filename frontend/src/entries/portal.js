import '../styles/app.css';
import { CONFIG } from '../core/config.js';
import { registerPwa } from '../core/pwa.js';
import { router } from '../core/router.js';
import { restoreSession, logout } from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';
import { toast } from '../core/toast.js';
import { store } from '../core/store.js';
import { logger } from '../core/logger.js';
import { getPortalRole, getAppAccess } from '../core/access.js';
import { permissionEngine } from '../core/permission.js';
import { appRegistry } from '../apps/registry.js';
import { portalAppManifests } from '../apps/manifests.js';

const root = document.querySelector('#app');
const SIDEBAR_KEY = 'portal.sidebarCollapsed';
let activeSession = null;
let pwaRegistration = null;
let shellAbortController = null;
let currentManifest = null;
let navigationSequence = 0;
appRegistry.registerMany(portalAppManifests);

const icon = (name) => ({
  menu: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  apps: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  search: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  home: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
  users: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 8M17 15a6 6 0 0 1 5 6"/></svg>',
  report: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 10 4 4 4-4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1h-4v-.1a1.7 1.7 0 0 0-1.06-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3v-4h.1A1.7 1.7 0 0 0 4.67 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.1A1.7 1.7 0 0 0 15.5 4.67a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.36.73.65 1 .29.27.65.47 1.05.57h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></svg>'
}[name] || '<span class="text-base">•</span>');

function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function getUsername(session) { return session?.user?.name || session?.user?.displayName || session?.user?.username || session?.profile?.user?.username || 'User'; }
function getVisibleManifests() { return permissionEngine.filterManifests(activeSession, appRegistry.list({ menuOnly: true })); }
function getDefaultRoute() { return 'dashboard'; }
function getRouteFromHash() { const route = location.hash.replace(/^#/,'').trim(); return appRegistry.getByRoute(route) ? route : getDefaultRoute(); }
function isLauncher(manifest) { return !manifest || manifest.id === 'dashboard'; }
function sidebarCollapsed() { return localStorage.getItem(SIDEBAR_KEY) === 'true'; }

function renderProfile(session, isPortalAdmin, activeRole) {
  const username = getUsername(session);
  const role = String(activeRole || getPortalRole(session) || 'USER').trim().toUpperCase();
  return `<div class="relative">
    <button id="profile-button" type="button" class="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-sm transition hover:bg-slate-50 sm:gap-3 sm:px-3" aria-expanded="false">
      <span class="grid h-8 w-8 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">${escapeHtml(username).slice(0,1).toUpperCase()}</span>
      <span class="hidden max-w-36 truncate font-medium text-slate-700 sm:inline">${escapeHtml(username)}</span>${icon('chevron')}
    </button>
    <div id="profile-menu" class="absolute right-0 top-full z-50 mt-2 hidden w-[calc(100vw-2rem)] max-w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
      <div class="rounded-xl bg-slate-50 p-3"><p class="truncate font-semibold text-slate-900">${escapeHtml(username)}</p><p class="mt-1 text-xs font-semibold text-slate-500">${escapeHtml(role)}</p></div>
      <div class="mt-3 grid gap-2">${isPortalAdmin ? '<button id="settings-button" type="button" class="app-button-secondary w-full justify-start">Settings</button>' : ''}<button id="logout-button" type="button" class="app-button-secondary w-full justify-start text-red-600">Logout</button></div>
    </div>
  </div>`;
}

function renderLauncherShell(session) {
  const isAdmin = getPortalRole(session) === 'ADMIN';
  root.innerHTML = `<div class="portal-shell-transition min-h-screen bg-slate-100 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div class="mx-auto flex min-h-[72px] max-w-[1500px] items-center gap-4 px-4 sm:px-6">
      <div class="min-w-0"><p class="font-bold text-slate-900">Portal Web</p><p class="text-xs text-slate-500">Azko Kudus Sudirman</p></div>
      <div class="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <button type="button" class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600" title="Notifikasi">${icon('bell')}</button>
        ${renderProfile(session, isAdmin, getPortalRole(session))}
      </div>
    </div></header>
    <main id="portal-content" class="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden"></main>
  </div>`;
}

function renderAppShell(session, manifest) {
  const isAdmin = getPortalRole(session) === 'ADMIN';
  const collapsed = sidebarCollapsed();
  const gate = permissionEngine.getAppGate(session, manifest.id);
  const items = permissionEngine.filterInternalMenu(session, manifest.internalMenu || [], manifest.id);
  const regularItems = items.filter((item) => !item.adminOnly);
  const adminItems = items.filter((item) => item.adminOnly);
  const renderMenuButton = (item, extraClass = '') => `<button type="button" data-internal-route="${escapeHtml(item.route)}" data-tooltip="${escapeHtml(item.title)}" class="sidebar-link flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${extraClass}">${icon(item.icon)}<span class="sidebar-label">${escapeHtml(item.title)}</span></button>`;
  const menu = regularItems.map((item) => renderMenuButton(item)).join('');
  const adminMenu = permissionEngine.isAppAdmin(session, manifest.id) && adminItems.length ? `<div class="mt-auto border-t border-slate-200 pt-3"><button id="app-admin-toggle" type="button" class="sidebar-link flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100" aria-expanded="false">${icon('settings')}<span class="sidebar-label flex-1">Admin Panel</span><span class="sidebar-label text-xs">⌄</span></button><div id="app-admin-submenu" class="mt-1 hidden space-y-1 pl-3">${adminItems.map((item) => renderMenuButton(item, 'text-[13px]')).join('')}</div></div>` : '';
  root.innerHTML = `<div class="portal-shell-transition min-h-screen bg-slate-100 lg:flex lg:h-full lg:overflow-hidden">
    <div id="sidebar-backdrop" class="fixed inset-0 z-40 hidden bg-slate-950/40 lg:hidden"></div>
    <aside id="app-sidebar" class="app-sidebar ${collapsed ? 'is-collapsed' : ''} fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:h-screen">
      <div class="sidebar-brand-text border-b border-slate-200 pb-4"><p class="truncate text-base font-bold text-slate-900">${escapeHtml(manifest.title)}</p><p class="mt-1 truncate text-xs text-slate-500"><button data-go-launcher class="hover:text-slate-900">Portal</button> / ${escapeHtml(manifest.shortTitle || manifest.title)} / <span id="breadcrumb-page">Dashboard</span></p></div>
      <nav class="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">${menu || `<button class="sidebar-link flex min-h-11 items-center gap-3 rounded-xl bg-brand-50 px-3 text-sm font-semibold text-brand-700">${icon('home')}<span class="sidebar-label">Dashboard</span></button>`}${adminMenu}</nav>
      <p class="sidebar-section-label mt-4 text-center text-[11px] text-slate-400">Portal v0.5.6 | Design by Fredi</p>
    </aside>
    <section class="app-workspace min-w-0 flex-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div class="flex min-h-[72px] items-center gap-2 px-4 sm:px-6">
        <button id="toggle-sidebar" type="button" class="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" title="Perkecil / buka sidebar">${icon('menu')}</button>
        <button id="all-apps-button" type="button" class="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" title="Kembali ke Portal Launcher">${icon('apps')}</button>
        <div class="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          ${permissionEngine.isReadOnly(session, manifest.id) ? '<span class="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 md:inline-flex">Read only</span>' : ''}
          <button type="button" class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600" title="Notifikasi">${icon('bell')}</button>
          ${renderProfile(session, isAdmin, gate.role)}
        </div>
      </div></header>
      <main id="portal-content" class="p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"></main>
    </section>
  </div>`;
}

function renderGateMessage(manifest, gate) {
  const title = gate.reason === 'NO_ROLE' ? 'Kamu belum terdaftar di aplikasi ini' : gate.reason === 'INACTIVE' ? 'Akses aplikasi sedang dinonaktifkan' : 'Akses aplikasi tidak tersedia';
  const message = gate.reason === 'NO_ROLE' ? 'Silakan hubungi Administrator untuk mendapatkan role aplikasi.' : gate.reason === 'INACTIVE' ? 'Silakan hubungi Administrator untuk mengaktifkan kembali akses Anda.' : 'Aplikasi ini tidak tersedia untuk akun Anda.';
  document.querySelector('#portal-content').innerHTML = `<div class="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center"><article class="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl">!</div><h1 class="mt-5 text-2xl font-bold text-slate-900">${escapeHtml(title)}</h1><p class="mt-3 text-sm leading-6 text-slate-500">${escapeHtml(message)}</p><button data-go-launcher type="button" class="app-button-primary mt-6">Kembali ke All Apps</button></article></div>`;
}

function registerRoutes() { appRegistry.list().forEach((manifest) => router.register(manifest.route, manifest.loader)); }
function createNavigator() {
  registerRoutes();

  const navigate = async (route, options = {}) => {
    const sequence = ++navigationSequence;
    const manifest = appRegistry.getByRoute(route) || appRegistry.getByRoute('dashboard');

    // Ganti shell segera. Proses unmount/mount modul tidak boleh menahan respons tombol navigasi.
    document.documentElement.classList.add('portal-navigating');
    currentManifest = manifest;
    if (isLauncher(manifest)) renderLauncherShell(activeSession); else renderAppShell(activeSession, manifest);
    bindShellEvents(navigate);

    const container = document.querySelector('#portal-content');
    if (!isLauncher(manifest)) {
      const gate = permissionEngine.getAppGate(activeSession, manifest.id);
      if (!gate.allowed) {
        renderGateMessage(manifest, gate);
        history.replaceState(null, '', `#${manifest.route}`);
        requestAnimationFrame(() => document.documentElement.classList.remove('portal-navigating'));
        return;
      }
    }

    try {
      await router.navigate(manifest.route, {
        container,
        mode: 'portal',
        session: activeSession,
        manifest,
        internalMenu: permissionEngine.filterInternalMenu(activeSession, manifest.internalMenu || [], manifest.id),
        visibleManifests: getVisibleManifests(),
        navigate,
        historyMode: options.historyMode || 'push'
      });
    } finally {
      if (sequence === navigationSequence) {
        requestAnimationFrame(() => document.documentElement.classList.remove('portal-navigating'));
      }
    }
  };

  return navigate;
}

function bindShellEvents(navigate) {
  shellAbortController?.abort(); shellAbortController = new AbortController(); const { signal } = shellAbortController;
  const profileButton = document.querySelector('#profile-button'); const profileMenu = document.querySelector('#profile-menu');
  profileButton?.addEventListener('click', () => { const open = profileMenu?.classList.contains('hidden'); profileMenu?.classList.toggle('hidden', !open); profileButton.setAttribute('aria-expanded', String(Boolean(open))); }, { signal });
  document.addEventListener('click', (event) => { if (profileMenu && profileButton && !profileMenu.contains(event.target) && !profileButton.contains(event.target)) { profileMenu.classList.add('hidden'); profileButton.setAttribute('aria-expanded','false'); } }, { signal });
  document.querySelector('#settings-button')?.addEventListener('click', async () => { const { openSettings } = await import('../settings/settings-shell.js'); await openSettings({ session: activeSession, initialTab: 'users' }); }, { signal });
  document.querySelector('#logout-button')?.addEventListener('click', async () => { await logout(); activeSession = null; showLogin(); }, { signal });
  document.querySelectorAll('[data-go-launcher], #all-apps-button').forEach((button) => button.addEventListener('click', () => navigate('dashboard', { historyMode: 'push' }), { signal }));
  document.querySelector('#toggle-sidebar')?.addEventListener('click', () => {
    const sidebar = document.querySelector('#app-sidebar');
    if (window.innerWidth < 1024) { sidebar?.classList.toggle('is-mobile-open'); document.querySelector('#sidebar-backdrop')?.classList.toggle('hidden'); return; }
    sidebar?.classList.toggle('is-collapsed'); localStorage.setItem(SIDEBAR_KEY, String(sidebar?.classList.contains('is-collapsed')));
  }, { signal });
  document.querySelector('#sidebar-backdrop')?.addEventListener('click', () => { document.querySelector('#app-sidebar')?.classList.remove('is-mobile-open'); document.querySelector('#sidebar-backdrop')?.classList.add('hidden'); }, { signal });
  document.querySelector('#app-admin-toggle')?.addEventListener('click', () => {
    const submenu = document.querySelector('#app-admin-submenu');
    const toggle = document.querySelector('#app-admin-toggle');
    const willOpen = submenu?.classList.contains('hidden');
    submenu?.classList.toggle('hidden', !willOpen);
    toggle?.setAttribute('aria-expanded', String(Boolean(willOpen)));
  }, { signal });
  document.querySelectorAll('[data-internal-route]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-internal-route]').forEach((item) => item.classList.remove('bg-brand-50','text-brand-700','bg-slate-100','text-slate-900'));
    button.classList.add('bg-slate-100','text-slate-900');
    const crumb = document.querySelector('#breadcrumb-page'); if (crumb) crumb.textContent = button.dataset.tooltip || button.textContent.trim();
    document.querySelector('#app-sidebar')?.classList.remove('is-mobile-open'); document.querySelector('#sidebar-backdrop')?.classList.add('hidden');
  }, { signal }));
  window.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!isLauncher(currentManifest)) navigate('dashboard', { historyMode: 'push' }).then(() => document.querySelector('#portal-app-search')?.focus()); else document.querySelector('#portal-app-search')?.focus(); } }, { signal });
  window.addEventListener('hashchange', () => { const route = getRouteFromHash(); if (store.getState().route !== route) navigate(route, { historyMode: 'none' }); }, { signal });
}

async function showAuthenticatedPortal(session) {
  activeSession = session;
  const navigate = createNavigator();
  await navigate(getRouteFromHash(), { historyMode: 'replace' });
}
function showLogin() { shellAbortController?.abort(); renderLoginView(root, { title: 'Login', subtitle: 'Masuk untuk mengakses Portal Web Azko Kudus Sudirman.', submitText: 'Masuk', onSuccess: showAuthenticatedPortal }); }
async function startPortal() {
  root.innerHTML = '<div class="portal-login-bg flex min-h-screen items-center justify-center p-4"><div class="rounded-2xl border border-white/10 bg-slate-800/90 p-6 text-center text-white shadow-xl"><p class="font-semibold">Portal Web</p><p class="mt-2 text-sm text-slate-300">Memeriksa sesi...</p></div></div>';
  let session = null; try { session = await restoreSession(); } catch (error) { logger.warn('Portal session restore failed', { message: error.message }); }
  if (!session || session.authenticated !== true) return showLogin();
  await showAuthenticatedPortal(session);
}
async function startPwa() { try { const result = await registerPwa(); pwaRegistration = result?.registration || null; } catch (error) { logger.warn('PWA registration failed', { message: error.message }); } }
startPwa(); startPortal();
