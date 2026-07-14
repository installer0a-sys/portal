import '../styles/app.css';
import { registerPwa } from '../core/pwa.js';
import { toast } from '../core/toast.js';
import { auth } from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';
import { mount as mountAppA, unmount as unmountAppA } from '../apps/app-a/index.js';

const app = document.querySelector('#app');

function hasPermission(profile, permission) {
  return Boolean(profile?.access?.permissions?.includes(permission));
}

async function showLogin() {
  await unmountAppA();
  renderLoginView({
    title: 'Masuk ke App A',
    subtitle: 'Login akan langsung membuka App A tanpa memuat Dashboard Portal.',
    onSubmit: async ({ username, password }) => {
      const profile = await auth.login(username, password);
      if (!hasPermission(profile, 'appA.access')) {
        await auth.logout();
        throw new Error('Akun tidak memiliki akses App A.');
      }
      await renderStandalone(profile);
      toast.success('Login App A berhasil.');
    }
  });
}

async function renderStandalone(profile) {
  app.innerHTML = `
    <div class="min-h-screen bg-slate-100">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Direct App Launch</p>
            <h1 class="font-bold text-slate-900">App A</h1>
          </div>
          <button type="button" data-logout class="app-button-secondary">Logout</button>
        </div>
      </header>
      <main id="standalone-content" class="mx-auto max-w-5xl p-4 sm:p-6"></main>
    </div>
  `;

  await mountAppA(document.querySelector('#standalone-content'), {
    profile,
    mode: 'standalone'
  });

  document.querySelector('[data-logout]').addEventListener('click', async () => {
    await auth.logout();
    await showLogin();
  });

  registerPwa();
}

const profile = await auth.restoreSession();
if (profile && hasPermission(profile, 'appA.access')) {
  await renderStandalone(profile);
} else {
  await showLogin();
}
