import '../styles/app.css';

import {
  registerPwa
} from '../core/pwa.js';
import {
  restoreSession,
  logout
} from '../auth/auth.js';
import {
  renderLoginView
} from '../auth/login-view.js';
import {
  lifecycleManager
} from '../core/lifecycle.js';
import {
  appRegistry
} from '../apps/registry.js';
import {
  appAManifest
} from '../apps/app-a/manifest.js';
import {
  logger
} from '../core/logger.js';

const root =
  document.querySelector('#app');

let shellAbortController = null;

appRegistry.register(
  appAManifest
);

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

            <h1 class="font-bold text-slate-900">
              ${escapeHtml(
                appAManifest.title
              )}
            </h1>
          </div>

          <div class="flex items-center gap-2">
            <span class="hidden text-sm text-slate-600 sm:inline">
              ${escapeHtml(username)}
            </span>

            <button
              data-app-logout
              type="button"
              class="app-button-secondary"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main
        id="standalone-content"
        class="mx-auto max-w-5xl p-4 sm:p-6"
      ></main>
    </div>
  `;
}

async function showApp(session) {
  renderShell(session);

  shellAbortController?.abort();

  shellAbortController =
    new AbortController();

  document
    .querySelector(
      '[data-app-logout]'
    )
    ?.addEventListener(
      'click',
      async () => {
        await lifecycleManager.deactivate(
          'standalone-logout'
        );

        await logout();

        showLogin();
      },
      {
        signal:
          shellAbortController.signal
      }
    );

  await lifecycleManager.activate({
    name:
      `${appAManifest.id}-standalone`,
    loader:
      appAManifest.loader,
    container:
      document.querySelector(
        '#standalone-content'
      ),
    context: {
      mode:
        'standalone',
      session,
      manifest:
        appAManifest
    }
  });
}

function showLogin() {
  shellAbortController?.abort();
  shellAbortController = null;

  renderLoginView(
    root,
    {
      title:
        `Masuk ke ${appAManifest.title}`,
      subtitle:
        `Login langsung ke ${appAManifest.title} tanpa memuat Portal.`,
      submitText:
        'Masuk',
      onSuccess:
        async (session) => {
          await showApp(
            session
          );
        }
    }
  );
}

async function startApp() {
  let session = null;

  try {
    session =
      await restoreSession();
  } catch (error) {
    logger.warn(
      'Standalone session restore failed',
      {
        appId:
          appAManifest.id,
        message:
          error.message
      }
    );
  }

  if (
    !session ||
    session.authenticated !== true
  ) {
    showLogin();
    return;
  }

  await showApp(session);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll(
      "'",
      '&#039;'
    );
}

registerPwa().catch(() => {});
startApp();
