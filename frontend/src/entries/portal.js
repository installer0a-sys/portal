import '../styles/app.css';

import { CONFIG } from '../core/config.js';
import { callApi } from '../core/api.js';
import { registerPwa } from '../core/pwa.js';
import { router } from '../core/router.js';
import { restoreSession, logout } from '../auth/auth.js';
import { renderLoginView } from '../auth/login-view.js';
import { toast } from '../core/toast.js';
import { store } from '../core/store.js';

const root = document.querySelector('#app');

let activeSession = null;
let pwaRegistration = null;

function getPortalRole(session) {
  return (
    session?.user?.portalRole ||
    session?.access?.portal?.role ||
    'NONE'
  );
}

function getAppARole(session) {
  return (
    session?.access?.apps?.appA?.role ||
    session?.access?.appA?.role ||
    'NONE'
  );
}

function renderPortalShell(session) {
  const username =
    session?.user?.username ||
    session?.user?.name ||
    'User';

  const portalRole = getPortalRole(session);
  const appARole = getAppARole(session);

  root.innerHTML = `
    <div class="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
      <div
        id="sidebar-backdrop"
        class="fixed inset-0 z-30 hidden bg-slate-950/40 lg:hidden"
      ></div>

      <aside
        id="sidebar"
        class="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full
               border-r border-slate-200 bg-white p-4
               transition-transform duration-200
               lg:static lg:w-auto lg:translate-x-0"
      >
        <div class="mb-6 flex items-center justify-between gap-4">
          <div>
            <p
              class="text-xs font-semibold uppercase tracking-[0.18em]
                     text-blue-600"
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
            class="app-button-secondary min-h-10 px-3 lg:hidden"
            aria-label="Tutup menu"
          >
            ×
          </button>
        </div>

        <nav class="space-y-2">
          <button
            type="button"
            data-route="dashboard"
            class="app-button-secondary w-full justify-start"
          >
            Dashboard
          </button>

          <button
            type="button"
            data-route="appA"
            class="app-button-secondary w-full justify-start"
          >
            App A
          </button>
        </nav>

        <div class="mt-6 rounded-2xl bg-slate-50 p-4 text-sm">
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
          class="sticky top-0 z-20 border-b border-slate-200
                 bg-white/95 backdrop-blur"
        >
          <div
            class="flex min-h-16 items-center gap-2 px-4 sm:px-6"
          >
            <button
              id="open-sidebar"
              type="button"
              class="app-button-secondary min-h-10 px-3 lg:hidden"
              aria-label="Buka menu"
            >
              ☰
            </button>

            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-slate-900">
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
              class="hidden rounded-full bg-emerald-100 px-3 py-1
                     text-xs font-semibold text-emerald-700 sm:inline-flex"
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
              class="app-button-secondary hidden min-h-10 px-3 sm:inline-flex"
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

function setSidebarOpen(open) {
  const sidebar = document.querySelector('#sidebar');
  const backdrop =
    document.querySelector('#sidebar-backdrop');

  if (!sidebar || !backdrop) return;

  sidebar.classList.toggle(
    '-translate-x-full',
    !open
  );

  backdrop.classList.toggle('hidden', !open);
}

function updateNetworkStatus() {
  const element =
    document.querySelector('#network-status');

  if (!element) return;

  const online = navigator.onLine;

  element.textContent = online
    ? 'Online'
    : 'Offline';

  element.className = online
    ? `hidden rounded-full bg-emerald-100 px-3 py-1
       text-xs font-semibold text-emerald-700 sm:inline-flex`
    : `hidden rounded-full bg-amber-100 px-3 py-1
       text-xs font-semibold text-amber-700 sm:inline-flex`;
}

function updateRouteUI(routeName) {
  const routeLabel =
    document.querySelector('#current-route-label');

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

function getInitialRoute() {
  const route = window.location.hash
    .replace('#', '')
    .trim();

  if (route === 'appA') {
    return 'appA';
  }

  return 'dashboard';
}

function registerRoutes(contentContainer) {
  router.register(
    'dashboard',
    () => import('../apps/dashboard/index.js')
  );

  router.register(
    'appA',
    () => import('../apps/app-a/index.js')
  );

  const navigate = async (
    routeName,
    {
      historyMode = 'push'
    } = {}
  ) => {
    updateRouteUI(routeName);

    await router.navigate(routeName, {
      container: contentContainer,
      mode: 'portal',
      session: activeSession,
      historyMode
    });

    setSidebarOpen(false);
  };

  return navigate;
}

function bindGlobalActions(navigate) {
  document
    .querySelector('#open-sidebar')
    ?.addEventListener('click', () => {
      setSidebarOpen(true);
    });

  document
    .querySelector('#close-sidebar')
    ?.addEventListener('click', () => {
      setSidebarOpen(false);
    });

  document
    .querySelector('#sidebar-backdrop')
    ?.addEventListener('click', () => {
      setSidebarOpen(false);
    });

  document
    .querySelectorAll('[data-route]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        navigate(button.dataset.route);
      });
    });

  document
    .querySelector('#open-core-test')
    ?.addEventListener('click', async () => {
      const { modal } = await import(
        '../core/modal.js'
      );

      const { diagnostics } = await import(
        '../core/diagnostics.js'
      );

      const snapshot = diagnostics.snapshot();

      modal.open({
        title: 'Core Diagnostics',
        content: `
          <pre
            class="max-h-[65vh] overflow-auto rounded-xl
                   bg-slate-950 p-4 text-xs leading-5
                   text-slate-100"
          >${JSON.stringify(snapshot, null, 2)}</pre>
        `,
        confirmText: 'Tutup'
      });
    });

  document
    .querySelector('#check-update')
    ?.addEventListener('click', async () => {
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
    });

  document
    .querySelector('#logout-button')
    ?.addEventListener('click', async () => {
      await logout();

      activeSession = null;

      await startPortal();
    });

  window.addEventListener(
    'online',
    updateNetworkStatus
  );

  window.addEventListener(
    'offline',
    updateNetworkStatus
  );

  window.addEventListener(
    'hashchange',
    () => {
      const routeName = getInitialRoute();

      if (
        store.getState().route !== routeName
      ) {
        navigate(routeName, {
          historyMode: 'none'
        });
      }
    }
  );
}

async function startAuthenticatedPortal(session) {
  activeSession = session;

  renderPortalShell(session);

  const contentContainer =
    document.querySelector('#portal-content');

  const navigate =
    registerRoutes(contentContainer);

  bindGlobalActions(navigate);
  updateNetworkStatus();

  const initialRoute = getInitialRoute();

  await navigate(initialRoute, {
    historyMode: 'replace'
  });

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

function showLogin() {
  renderLoginView(root, {
    title: 'Masuk ke Portal',
    subtitle:
      'Gunakan username dan password Portal.',
    submitText: 'Masuk',
    onSuccess: async () => {
      await startPortal();
    }
  });
}

async function startPortal() {
  root.innerHTML = `
    <div
      class="flex min-h-screen items-center justify-center
             bg-slate-100 p-4"
    >
      <div class="app-card w-full max-w-sm text-center">
        <p class="text-sm font-semibold text-blue-600">
          Portal V3
        </p>

        <p class="mt-2 text-sm text-slate-600">
          Memeriksa sesi...
        </p>
      </div>
    </div>
  `;

  const session =
    await restoreSession();

  if (!session.authenticated) {
    showLogin();
    return;
  }

  await startAuthenticatedPortal(session);
}

async function startPwa() {
  const result = await registerPwa();

  pwaRegistration =
    result?.registration || null;
}

startPwa();
startPortal();
