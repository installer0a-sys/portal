import '../styles/app.css';
import { CONFIG } from '../core/config.js';
import { callApi } from '../core/api.js';
import { registerPwa } from '../core/pwa.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { diagnostics } from '../core/diagnostics.js';
import { auth } from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';

const app = document.querySelector('#app');
document.title = CONFIG.appName;

async function showLogin() {
  renderLoginView({
    title: 'Masuk ke Portal',
    subtitle: 'Gunakan username dan password Portal Anda.',
    onSubmit: async ({ username, password }) => {
      const profile = await auth.login(username, password);
      if (!profile.access.permissions.includes('portal.access')) {
        await auth.logout();
        throw new Error('Akun tidak memiliki akses Portal.');
      }
      renderPortal(profile);
      toast.success('Login berhasil.');
    }
  });
}

function renderPortal(profile) {
  app.innerHTML = `
    <div class="min-h-screen bg-slate-100">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Portal V3</p>
            <h1 class="truncate text-xl font-bold text-slate-900">${CONFIG.appName}</h1>
            <p class="truncate text-xs text-slate-500">${profile.user.username} · ${profile.access.portalRole}</p>
          </div>
          <div class="flex items-center gap-2">
            <span id="online-status" class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Online</span>
            <button id="logout" class="app-button-secondary" type="button">Logout</button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section class="grid gap-4 lg:grid-cols-3">
          <article class="app-card lg:col-span-2">
            <p class="text-sm font-semibold text-blue-600">Authentication aktif</p>
            <h2 class="mt-2 text-2xl font-bold text-slate-900">Portal Core V3</h2>
            <p class="mt-3 text-sm leading-6 text-slate-600">Sesi, role Portal, role per aplikasi, dan permission sudah diverifikasi backend.</p>
            <div class="mt-6 flex flex-wrap gap-3">
              <button id="test-api" type="button" class="app-button-primary">Tes koneksi API</button>
              ${profile.access.permissions.includes('appA.access') ? `<a href="${CONFIG.basePath}app-a/" class="app-button-secondary">Buka App A langsung</a>` : ''}
              <button id="open-core-test" type="button" class="app-button-secondary">Buka Core Test</button>
            </div>
          </article>

          <aside class="app-card">
            <h3 class="text-sm font-bold text-slate-900">Access information</h3>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-4"><dt class="text-slate-500">Portal role</dt><dd class="font-semibold">${profile.access.portalRole}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-slate-500">App A role</dt><dd class="font-semibold">${profile.access.appRoles.appA || 'NONE'}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-slate-500">Permission key</dt><dd class="font-mono text-xs">${profile.access.permissionSignature}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-slate-500">PWA</dt><dd id="pwa-status" class="font-semibold">Memeriksa</dd></div>
            </dl>
          </aside>
        </section>

        <section class="mt-4 grid gap-4 md:grid-cols-2">
          <article class="app-card">
            <h3 class="text-lg font-bold">API diagnostics</h3>
            <pre id="api-result" class="mt-4 min-h-40 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">Belum diuji.</pre>
          </article>
          <article class="app-card">
            <h3 class="text-lg font-bold">Permissions</h3>
            <div class="mt-4 flex flex-wrap gap-2">${profile.access.permissions.map((permission) => `<span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">${permission}</span>`).join('')}</div>
          </article>
        </section>
      </main>
    </div>`;

  const onlineElement = document.querySelector('#online-status');
  const updateOnline = () => {
    onlineElement.textContent = navigator.onLine ? 'Online' : 'Offline';
    onlineElement.className = navigator.onLine
      ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
      : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700';
  };
  window.addEventListener('online', updateOnline, { once: false });
  window.addEventListener('offline', updateOnline, { once: false });
  updateOnline();

  document.querySelector('#logout').addEventListener('click', async () => {
    await auth.logout();
    await showLogin();
    toast.info('Anda telah logout. Cache aplikasi tetap dipertahankan dan dipisahkan per user/permission.');
  });

  document.querySelector('#test-api').addEventListener('click', async () => {
    const resultElement = document.querySelector('#api-result');
    resultElement.textContent = 'Menghubungi Apps Script...';
    try {
      const result = await callApi('system.ping');
      resultElement.textContent = JSON.stringify(result, null, 2);
      toast.success('Koneksi berhasil.');
    } catch (error) {
      resultElement.textContent = JSON.stringify({ error: error.message }, null, 2);
      toast.error(error.message);
    }
  });

  document.querySelector('#open-core-test').addEventListener('click', () => {
    modal.open({
      title: 'Core Diagnostics',
      content: `<pre class="max-h-[60vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">${JSON.stringify(diagnostics.snapshot(), null, 2)}</pre>`,
      confirmText: 'Tutup'
    });
  });

  registerPwa().then((pwa) => {
    const pwaStatus = document.querySelector('#pwa-status');
    if (pwaStatus) pwaStatus.textContent = pwa.registered ? 'Aktif' : pwa.supported ? 'Gagal' : 'Tidak didukung';
  });
}

const profile = await auth.restore();
if (profile && profile.access.permissions.includes('portal.access')) {
  renderPortal(profile);
} else {
  await showLogin();
}
