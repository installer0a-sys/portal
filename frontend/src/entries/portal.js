import '../styles/app.css';

import { CONFIG } from '../core/config.js';
import { registerPwa } from '../core/pwa.js';
import { router } from '../core/router.js';
import {
  restoreSession,
  logout
} from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';
import { toast } from '../core/toast.js';
import { store } from '../core/store.js';
import { logger } from '../core/logger.js';

const root = document.querySelector('#app');

let activeSession = null;
let pwaRegistration = null;
let shellAbortController = null;

/**
 * Mengambil Portal Role dari beberapa kemungkinan format respons.
 */
function getPortalRole(session) {
  return (
    session?.user?.portalRole ||
    session?.access?.portal?.role ||
    session?.access?.portalRole ||
    'NONE'
  );
}

/**
 * Mengambil role App A dari beberapa kemungkinan format respons.
 */
function getAppARole(session) {
  return (
    session?.access?.apps?.appA?.role ||
    session?.access?.appA?.role ||
    session?.user?.appRoles?.appA ||
    'NONE'
  );
}

/**
 * Memastikan hasil restoreSession selalu berbentuk object.
 *
 * Ini memperbaiki error:
 * Cannot read properties of null (reading 'authenticated')
 */
async function resolveSessionSafely() {
  try {
    const session = await restoreSession();

    if (!session || typeof session !== 'object') {
      logger.warn(
        'restoreSession returned an invalid result',
        {
          result: session
        }
      );

      return {
        authenticated: false,
        source: 'invalid-result'
      };
    }

    return session;
  } catch (error) {
    logger.error(
      'Session restoration failed',
      {
        message: error.message
      }
    );

    return {
      authenticated: false,
      source: 'error',
      error: error.message
    };
  }
}

/**
 * Menampilkan shell Portal setelah autentikasi berhasil.
 */
function renderPortalShell(session) {
  const username =
    session?.user?.username ||
    session?.user?.name ||
    'User';

  const portalRole = getPortalRole(session);
  const appARole = getAppARole(session);

  root.innerHTML = `
    <div
      class="min-h-screen bg-slate-100
             lg:grid lg:grid-cols-[260px_1fr]"
    >
      <div
        id="sidebar-backdrop"
        class="fixed inset-0 z-30 hidden
               bg-slate-950/40 lg:hidden"
      ></div>

      <aside
        id="sidebar"
        class="fixed inset-y-0 left-0 z-40
               w-72 -translate-x-full
               border-r border-slate-200
               bg-white p-4
               transition-transform duration-200
               lg:static lg:w-auto lg:translate-x-0"
      >
        <div
          class="mb-6 flex items-center
                 justify-between gap-4"
        >
          <div>
            <p
              class="text-xs font-semibold uppercase
                     tracking-[0.18em] text-blue-600"
            >
              Portal V3
            </p>

            <h1 class="font-bold text-slate-900">
              ${CONFIG.appName}
            </h1>
          </div>

          <button
            id="close-sidebar"
            type="button"
            class="app-button-secondary
                   min-h-10 px-3 lg:hidden"
            aria-label="Tutup menu"
          >
            ×
          </button>
        </div>

        <nav class="space-y-2">
          <button
            type="button"
            data-route="dashboard"
            class="app-button-secondary
                   w-full justify-start"
          >
            Dashboard
          </button>

          <button
            type="button"
            data-route="appA"
            class="app-button-secondary
                   w-full justify-start"
          >
            App A
          </button>
        </nav>

        <div
          class="mt-6 rounded-2xl
                 bg-slate-50 p-4 text-sm"
        >
          <p class="font-semibold text-slate-900">
            ${username}
          </p>

          <div class="mt-3 space-y-2 text-xs">
            <div class="flex justify-between gap-4">
              <span class="text-slate-500">
                Portal role
              </span>

              <strong class="text-slate-800">
                ${portalRole}
              </strong>
            </div>

            <div class="flex justify-between gap-4">
              <span class="text-slate-500">
                App A role
              </span>

              <strong class="text-slate-800">
                ${appARole}
              </strong>
            </div>
          </div>
        </div>
      </aside>

      <div class="min-w-0">
        <header
          class="sticky top-0 z-20
                 border-b border-slate-200
                 bg-white/95 backdrop-blur"
        >
          <div
            class="flex min-h-16 items-center
                   gap-2 px-4 sm:px-6"
          >
            <button
              id="open-sidebar"
              type="button"
              class="app-button-secondary
                     min-h-10 px-3 lg:hidden"
              aria-label="Buka menu"
            >
              ☰
            </button>

            <div class="min-w-0 flex-1">
              <p
                class="truncate font-semibold
                       text-slate-900"
              >
                ${CONFIG.appName}
              </p>

              <p
                id="current-route-label"
                class="truncate text-xs text-slate-500"
              >
                Dashboard
              </p>
            </div>

            <span
              id="network-status"
              class="hidden rounded-full
                     bg-emerald-100 px-3 py-1
                     text-xs font-semibold
                     text-emerald-700 sm:inline-flex"
            >
              Online
            </span>

            <button
              id="open-core-test"
              type="button"
              class="app-button-secondary min-h-10 px-3"
            >
              Core Test
            </button>

            <button
              id="check-update"
              type="button"
              class="app-button-secondary hidden
                     min-h-10 px-3 sm:inline-flex"
            >
              Cek update
            </button>

            <button
              id="logout-button"
              type="button"
              class="app-button-secondary min-h-10 px-3"
            >
              Logout
            </button>
          </div>
        </header>

        <main
          id="portal-content"
          class="mx-auto max-w-7xl p-4 sm:p-6"
        ></main>
      </div>
    </div>
  `;
}

/**
 * Membuka atau menutup sidebar mobile.
 */
function setSidebarOpen(open) {
  const sidebar =
    document.querySelector('#sidebar');

  const backdrop =
    document.querySelector('#sidebar-backdrop');

  if (!sidebar || !backdrop) {
    return;
  }

  sidebar.classList.toggle(
    '-translate-x-full',
    !open
  );

  backdrop.classList.toggle(
    'hidden',
    !open
  );
}

/**
 * Memperbarui indikator online/offline.
 */
function updateNetworkStatus() {
  const element =
    document.querySelector('#network-status');

  if (!element) {
    return;
  }

  const online = navigator.onLine;

  element.textContent =
    online ? 'Online' : 'Offline';

  element.className = online
    ? [
        'hidden rounded-full',
        'bg-emerald-100 px-3 py-1',
        'text-xs font-semibold',
        'text-emerald-700 sm:inline-flex'
      ].join(' ')
    : [
        'hidden rounded-full',
        'bg-amber-100 px-3 py-1',
        'text-xs font-semibold',
        'text-amber-700 sm:inline-flex'
      ].join(' ');
}

/**
 * Memperbarui label dan tombol route aktif.
 */
function updateRouteUI(routeName) {
  const routeLabel =
    document.querySelector(
      '#current-route-label'
    );

  if (routeLabel) {
    routeLabel.textContent =
      routeName === 'appA'
        ? 'App A'
        : 'Dashboard';
  }

  document
    .querySelectorAll('[data-route]')
    .forEach((button) => {
      const active =
        button.dataset.route === routeName;

      button.className = active
        ? 'app-button-primary w-full justify-start'
        : 'app-button-secondary w-full justify-start';
    });
}

/**
 * Membaca route awal dari hash URL.
 */
function getInitialRoute() {
  const route = window.location.hash
    .replace(/^#/, '')
    .trim();

  if (route === 'appA') {
    return 'appA';
  }

  return 'dashboard';
}

/**
 * Mendaftarkan modul yang tersedia pada Portal.
 */
function createNavigator(contentContainer) {
  router.register(
    'dashboard',
    () => import(
      '../apps/dashboard/index.js'
    )
  );

  router.register(
    'appA',
    () => import(
      '../apps/app-a/index.js'
    )
  );

  return async function navigate(
    routeName,
    {
      historyMode = 'push'
    } = {}
  ) {
    const safeRoute =
      routeName === 'appA'
        ? 'appA'
        : 'dashboard';

    updateRouteUI(safeRoute);

    try {
      await router.navigate(
        safeRoute,
        {
          container: contentContainer,
          mode: 'portal',
          session: activeSession,
          historyMode
        }
      );

      setSidebarOpen(false);
    } catch (error) {
      logger.error(
        'Route navigation failed',
        {
          route: safeRoute,
          message: error.message
        }
      );

      toast.error(
        error.message ||
        'Aplikasi gagal dibuka.'
      );
    }
  };
}

/**
 * Mengikat semua event global Portal.
 */
function bindGlobalActions(navigate) {
  if (shellAbortController) {
    shellAbortController.abort();
  }

  shellAbortController =
    new AbortController();

  const { signal } =
    shellAbortController;

  document
    .querySelector('#open-sidebar')
    ?.addEventListener(
      'click',
      () => setSidebarOpen(true),
      { signal }
    );

  document
    .querySelector('#close-sidebar')
    ?.addEventListener(
      'click',
      () => setSidebarOpen(false),
      { signal }
    );

  document
    .querySelector('#sidebar-backdrop')
    ?.addEventListener(
      'click',
      () => setSidebarOpen(false),
      { signal }
    );

  document
    .querySelectorAll('[data-route]')
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          navigate(button.dataset.route);
        },
        { signal }
      );
    });

  document
    .querySelector('#open-core-test')
    ?.addEventListener(
      'click',
      async () => {
        const { modal } = await import(
          '../core/modal.js'
        );

        const { diagnostics } = await import(
          '../core/diagnostics.js'
        );

        const snapshot =
          diagnostics.snapshot();

        modal.open({
          title: 'Core Diagnostics',
          content: `
            <pre
              class="max-h-[65vh] overflow-auto
                     rounded-xl bg-slate-950
                     p-4 text-xs leading-5
                     text-slate-100"
            >${JSON.stringify(
              snapshot,
              null,
              2
            )}</pre>
          `,
          confirmText: 'Tutup'
        });
      },
      { signal }
    );

  document
    .querySelector('#check-update')
    ?.addEventListener(
      'click',
      async () => {
        if (!pwaRegistration) {
          toast.warning(
            'Service worker belum aktif.'
          );

          return;
        }

        try {
          await pwaRegistration.update();

          toast.success(
            'Pemeriksaan update selesai.'
          );
        } catch (error) {
          toast.error(
            error.message ||
            'Pemeriksaan update gagal.'
          );
        }
      },
      { signal }
    );

  document
    .querySelector('#logout-button')
    ?.addEventListener(
      'click',
      async () => {
        try {
          await logout();
        } finally {
          activeSession = null;

          if (shellAbortController) {
            shellAbortController.abort();
            shellAbortController = null;
          }

          await startPortal();
        }
      },
      { signal }
    );

  window.addEventListener(
    'online',
    updateNetworkStatus,
    { signal }
  );

  window.addEventListener(
    'offline',
    updateNetworkStatus,
    { signal }
  );

  window.addEventListener(
    'hashchange',
    () => {
      const routeName =
        getInitialRoute();

      if (
        store.getState().route !== routeName
      ) {
        navigate(
          routeName,
          {
            historyMode: 'none'
          }
        );
      }
    },
    { signal }
  );
}

/**
 * Menjalankan Portal setelah login.
 */
async function startAuthenticatedPortal(
  session
) {
  activeSession = session;

  renderPortalShell(session);

  const contentContainer =
    document.querySelector(
      '#portal-content'
    );

  if (!contentContainer) {
    throw new Error(
      'Portal content container tidak ditemukan.'
    );
  }

  const navigate =
    createNavigator(contentContainer);

  bindGlobalActions(navigate);
  updateNetworkStatus();

  const initialRoute =
    getInitialRoute();

  await navigate(
    initialRoute,
    {
      historyMode: 'replace'
    }
  );

  /**
   * Prefetch App A ketika browser sedang idle.
   */
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      import('../apps/app-a/index.js');
    });
  } else {
    window.setTimeout(() => {
      import('../apps/app-a/index.js');
    }, 1200);
  }
}

/**
 * Menampilkan halaman login.
 */
function showLogin() {
  if (shellAbortController) {
    shellAbortController.abort();
    shellAbortController = null;
  }

  renderLoginView(
    root,
    {
      title: 'Masuk ke Portal',
      subtitle:
        'Gunakan username dan password Portal.',
      submitText: 'Masuk',

      onSuccess: async () => {
        await startPortal();
      }
    }
  );
}

/**
 * Entry utama Portal.
 */
async function startPortal() {
  root.innerHTML = `
    <div
      class="flex min-h-screen items-center
             justify-center bg-slate-100 p-4"
    >
      <div
        class="app-card w-full max-w-sm
               text-center"
      >
        <p
          class="text-sm font-semibold
                 text-blue-600"
        >
          Portal V3
        </p>

        <p class="mt-2 text-sm text-slate-600">
          Memeriksa sesi...
        </p>
      </div>
    </div>
  `;

  const session =
    await resolveSessionSafely();

  /**
   * Jangan pernah membaca session.authenticated
   * tanpa memastikan session bukan null.
   */
  if (
    !session ||
    session.authenticated !== true
  ) {
    showLogin();
    return;
  }

  try {
    await startAuthenticatedPortal(
      session
    );
  } catch (error) {
    logger.error(
      'Portal startup failed',
      {
        message: error.message
      }
    );

    root.innerHTML = `
      <div
        class="flex min-h-screen items-center
               justify-center bg-slate-100 p-4"
      >
        <section
          class="app-card w-full max-w-md"
        >
          <p
            class="text-sm font-semibold
                   text-red-600"
          >
            Portal gagal dimuat
          </p>

          <p
            class="mt-2 text-sm
                   text-slate-600"
          >
            ${error.message}
          </p>

          <button
            id="retry-portal"
            type="button"
            class="app-button-primary mt-5"
          >
            Coba lagi
          </button>
        </section>
      </div>
    `;

    document
      .querySelector('#retry-portal')
      ?.addEventListener(
        'click',
        () => startPortal(),
        { once: true }
      );
  }
}

/**
 * Registrasi PWA tidak boleh menghambat startup.
 */
async function startPwa() {
  try {
    const result =
      await registerPwa();

    pwaRegistration =
      result?.registration || null;
  } catch (error) {
    logger.warn(
      'PWA registration failed',
      {
        message: error.message
      }
    );
  }
}

startPwa();
startPortal();
