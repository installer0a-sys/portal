import '../styles/app.css';

import { registerPwa } from '../core/pwa.js';
import { restoreSession, logout } from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';
import {
  mount as mountAppA,
  unmount as unmountAppA
} from '../apps/app-a/index.js';

const root = document.querySelector('#app');

let abortController = null;

function renderShell(session) {
  const username =
    session?.user?.username ||
    session?.user?.name ||
    'User';

  root.innerHTML = `
    <div class="min-h-screen bg-slate-100">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Direct App Launch
            </p>
            <h1 class="font-bold text-slate-900">App A</h1>
          </div>

          <div class="flex items-center gap-2">
            <span class="hidden text-sm text-slate-600 sm:inline">${username}</span>
            <button data-app-a-logout type="button" class="app-button-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main id="standalone-content" class="mx-auto max-w-5xl p-4 sm:p-6"></main>
    </div>
  `;
}

async function showApp(session) {
  renderShell(session);

  abortController?.abort();
  abortController = new AbortController();

  document.querySelector('[data-app-a-logout]')?.addEventListener(
    'click',
    async () => {
      await unmountAppA();
      await logout();
      showLogin();
    },
    { signal: abortController.signal }
  );

  await mountAppA(
    document.querySelector('#standalone-content'),
    {
      mode: 'standalone',
      session
    }
  );
}

function showLogin() {
  abortController?.abort();
  abortController = null;

  renderLoginView(root, {
    title: 'Masuk ke App A',
    subtitle: 'Login langsung ke App A tanpa memuat Portal.',
    submitText: 'Masuk',
    onSuccess: async (session) => {
      await showApp(session);
    }
  });
}

async function startAppA() {
  let session = null;

  try {
    session = await restoreSession();
  } catch {}

  if (!session || session.authenticated !== true) {
    showLogin();
    return;
  }

  await showApp(session);
}

registerPwa().catch(() => {});
startAppA();
