import '../styles/app.css';
import { callApi } from '../core/api.js';
import { registerPwa } from '../core/pwa.js';
import { toast } from '../core/toast.js';
import { auth } from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';

const app = document.querySelector('#app');

async function showLogin() {
  renderLoginView({
    title: 'Masuk ke App A',
    subtitle: 'Login akan langsung membuka App A tanpa memuat Dashboard Portal.',
    onSubmit: async ({ username, password }) => {
      const profile = await auth.login(username, password);
      if (!profile.access.permissions.includes('appA.access')) {
        await auth.logout();
        throw new Error('Akun tidak memiliki akses App A.');
      }
      renderApp(profile);
      toast.success('Login App A berhasil.');
    }
  });
}

function renderApp(profile) {
  app.innerHTML = `
    <main class="mx-auto flex min-h-screen max-w-xl items-center p-4">
      <section class="app-card w-full">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-blue-600">Direct App Launch</p>
            <h1 class="mt-1 text-2xl font-bold">App A</h1>
            <p class="mt-1 text-xs text-slate-500">${profile.user.username} · ${profile.access.appRoles.appA || 'NONE'}</p>
          </div>
          <button id="logout" class="app-button-secondary">Logout</button>
        </div>
        <p class="mt-4 text-sm leading-6 text-slate-600">Entry berdiri sendiri, memvalidasi sesi dan permission App A tanpa memuat Portal.</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button id="test" class="app-button-primary">Tes API App A</button>
          <a href="../" class="app-button-secondary">Kembali ke Portal</a>
        </div>
        <pre id="result" class="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">Belum diuji.</pre>
      </section>
    </main>`;

  document.querySelector('#test').addEventListener('click', async () => {
    const result = document.querySelector('#result');
    result.textContent = 'Menghubungkan...';
    try {
      result.textContent = JSON.stringify(await callApi('appA.ping'), null, 2);
    } catch (error) {
      result.textContent = `ERROR: ${error.message}`;
      toast.error(error.message);
    }
  });

  document.querySelector('#logout').addEventListener('click', async () => {
    await auth.logout();
    await showLogin();
  });

  registerPwa();
}

const profile = await auth.restore();
if (profile && profile.access.permissions.includes('appA.access')) {
  renderApp(profile);
} else {
  await showLogin();
}
