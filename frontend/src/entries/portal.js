import '../styles/app.css';
import { CONFIG } from '../core/config.js';
import { registerPwa } from '../core/pwa.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { diagnostics } from '../core/diagnostics.js';
import { router } from '../core/router.js';
import { auth } from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';

const app = document.querySelector('#app');
document.title = CONFIG.appName;

function hasPermission(profile, permission) {
  return Boolean(profile?.access?.permissions?.includes(permission));
}

async function showLogin() {
  await router.destroy();
  renderLoginView({
    title: 'Masuk ke Portal',
    subtitle: 'Gunakan username dan password Portal Anda.',
    onSubmit: async ({ username, password }) => {
      const profile = await auth.login(username, password);
      if (!hasPermission(profile, 'portal.access')) {
        await auth.logout();
        throw new Error('Akun tidak memiliki akses Portal.');
      }
      await renderPortal(profile);
      toast.success('Login berhasil.');
    }
  });
}

async function renderPortal(profile) {
  app.innerHTML = `
    <div class="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[250px_1fr]">
      <aside id="portal-sidebar" class="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full border-r border-slate-200 bg-white p-4 transition-transform lg:static lg:w-auto lg:translate-x-0">
        <div class="mb-6 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Portal V3</p>
            <h1 class="truncate font-bold text-slate-900">${CONFIG.appName}</h1>
          </div>
          <button type="button" data-close-sidebar class="app-button-secondary px-3 lg:hidden">×</button>
        </div>

        <nav class="space-y-2" aria-label="Menu Portal">
          <button type="button" data-route="dashboard" class="app-button-secondary w-full justify-start">Dashboard</button>
          ${hasPermission(profile, 'appA.access') ? `
            <button type="button" data-route="appA" class="app-button-secondary w-full justify-start">App A</button>
          ` : ''}
        </nav>

        <div class="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p class="font-semibold text-slate-700">${profile.user.username}</p>
          <p>${profile.access.portalRole || 'NONE'}</p>
        </div>
      </aside>

      <div class="min-w-0">
        <header class="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" data-open-sidebar class="app-button-secondary px-3 lg:hidden">☰</button>
          <div class="min-w-0 flex-1">
            <p id="route-title" class="truncate font-semibold text-slate-900">Dashboard</p>
            <p class="truncate text-xs text-slate-500">SPA modular · tanpa reload halaman</p>
          </div>
          <span id="online-status" class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Online</span>
          <button type="button" data-logout class="app-button-secondary">Logout</button>
        </header>

        <main id="portal-content" class="mx-auto max-w-7xl p-4 sm:p-6"></main>
      </div>
    </div>
  `;

  const sidebar = document.querySelector('#portal-sidebar');
  const content = document.querySelector('#portal-content');
  const title = document.querySelector('#route-title');
  const onlineStatus = document.querySelector('#online-status');

  const closeSidebar = () => sidebar.classList.add('-translate-x-full');
  document.querySelector('[data-open-sidebar]')?.addEventListener('click', () => {
    sidebar.classList.remove('-translate-x-full');
  });
  document.querySelector('[data-close-sidebar]')?.addEventListener('click', closeSidebar);

  const updateOnline = () => {
    onlineStatus.textContent = navigator.onLine ? 'Online' : 'Offline';
    onlineStatus.className = navigator.onLine
      ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
      : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700';
  };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  document.querySelector('[data-logout]').addEventListener('click', async () => {
    await auth.logout();
    await showLogin();
    toast.info('Anda telah logout. Cache aplikasi tetap dipertahankan.');
  });

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', async () => {
      await router.navigate(button.dataset.route);
      closeSidebar();
    });
  });

  const openDiagnostics = () => {
    modal.open({
      title: 'Core Diagnostics',
      content: `<pre class="max-h-[60vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">${JSON.stringify(diagnostics.snapshot(), null, 2)}</pre>`,
      confirmText: 'Tutup'
    });
  };

  router.register('dashboard', () => import('../apps/dashboard/index.js'));
  router.register('appA', () => import('../apps/app-a/index.js'));
  router.register('notFound', () => import('../apps/dashboard/index.js'));

  await router.start({
    container: content,
    profile,
    mode: 'portal',
    can: (permission) => hasPermission(profile, permission),
    openDiagnostics,
    onRouteChange: (route) => {
      title.textContent = route === 'appA' ? 'App A' : 'Dashboard';
      document.querySelectorAll('[data-route]').forEach((button) => {
        const active = button.dataset.route === route;
        button.classList.toggle('bg-blue-50', active);
        button.classList.toggle('text-blue-700', active);
        button.classList.toggle('border-blue-200', active);
      });
    }
  });

  const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 700));
  idle(() => router.prefetch('appA'));

  registerPwa();
}

const profile = await auth.restoreSession();
if (profile && hasPermission(profile, 'portal.access')) {
  await renderPortal(profile);
} else {
  await showLogin();
}
