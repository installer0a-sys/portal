import '../styles/app.css';

import { CONFIG } from '../core/config.js';
import { registerPwa } from '../core/pwa.js';
import { router } from '../core/router.js';
import {
  restoreSession,
  logout
} from '../auth/auth.js';
import {
  renderLoginView
} from '../auth/login-view.js';
import { toast } from '../core/toast.js';
import { store } from '../core/store.js';
import { logger } from '../core/logger.js';
import {
  getPortalRole,
  getAppRole
} from '../core/access.js';
import {
  permissionEngine
} from '../core/permission.js';
import {
  appRegistry
} from '../apps/registry.js';
import {
  portalAppManifests
} from '../apps/manifests.js';

const root =
  document.querySelector('#app');

let activeSession = null;
let pwaRegistration = null;
let shellAbortController = null;

appRegistry.registerMany(
  portalAppManifests
);

function getVisibleManifests() {
  return permissionEngine
    .filterManifests(
      activeSession,
      appRegistry.list({
        menuOnly: true
      })
    );
}

function getDefaultRoute() {
  const visible =
    getVisibleManifests();

  const dashboard =
    visible.find(
      (manifest) =>
        manifest.id ===
        'dashboard'
    );

  return (
    dashboard?.route ||
    visible[0]?.route ||
    'dashboard'
  );
}

function getRouteFromHash() {
  const route =
    location.hash
      .replace(/^#/, '')
      .trim();

  const manifest =
    appRegistry.getByRoute(
      route
    );

  if (
    manifest &&
    permissionEngine.canAccessManifest(
      activeSession,
      manifest
    )
  ) {
    return route;
  }

  return getDefaultRoute();
}

function renderMenuItems() {
  return getVisibleManifests()
    .map(
      (manifest) => `
        <button
          data-route="${escapeHtml(
            manifest.route
          )}"
          data-app-id="${escapeHtml(
            manifest.id
          )}"
          type="button"
          class="app-button-secondary w-full justify-start"
        >
          ${escapeHtml(
            manifest.shortTitle
          )}
        </button>
      `
    )
    .join('');
}

function renderPortalShell(session) {
  const portalRole = getPortalRole(session).toUpperCase();
  const isPortalAdmin = portalRole === 'ADMIN';

  const username =
    session?.user?.name ||
    session?.user?.username ||
    session?.profile?.user?.username ||
    'User';

  root.innerHTML = `
    <div class="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
      <div
        id="sidebar-backdrop"
        class="fixed inset-0 z-30 hidden bg-slate-950/40 lg:hidden"
      ></div>

      <aside
        id="sidebar"
        class="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full border-r border-slate-200 bg-white p-4 transition-transform lg:static lg:w-auto lg:translate-x-0"
      >
        <div class="mb-6 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
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
          ${renderMenuItems()}
        </nav>

        <div class="mt-6 rounded-2xl bg-slate-50 p-4 text-sm">
          <p class="font-semibold text-slate-900">
            ${escapeHtml(username)}
          </p>

          <div class="mt-3 space-y-2 text-xs">
            <div class="flex justify-between gap-4">
              <span class="text-slate-500">
                Portal role
              </span>

              <strong>
                ${escapeHtml(
                  getPortalRole(session)
                )}
              </strong>
            </div>

            <div class="flex justify-between gap-4">
              <span class="text-slate-500">
                App A role
              </span>

              <strong>
                ${escapeHtml(
                  getAppRole(
                    session,
                    'appA'
                  )
                )}
              </strong>
            </div>
          </div>
        </div>
      </aside>

      <div class="min-w-0">
        <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div class="flex min-h-16 items-center gap-2 px-4 sm:px-6">
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
                ${escapeHtml(
                  getDefaultRoute()
                )}
              </p>
            </div>

            <span
              id="network-status"
              class="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex"
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

            <div class="relative">
              <button
                id="profile-button"
                type="button"
                class="app-button-secondary min-h-10 gap-2 px-3"
                aria-haspopup="menu"
                aria-expanded="false"
              >
                <span class="grid h-7 w-7 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">${escapeHtml(username).slice(0, 1).toUpperCase()}</span>
                <span class="hidden max-w-32 truncate sm:inline">${escapeHtml(username)}</span>
              </button>
              <div id="profile-menu" class="absolute right-0 top-full z-50 mt-2 hidden w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl" role="menu">
                <div class="rounded-xl bg-slate-50 p-3">
                  <p class="truncate font-semibold text-slate-900">${escapeHtml(username)}</p>
                  <p class="mt-1 text-xs text-slate-500">Portal role: ${escapeHtml(getPortalRole(session))}</p>
                </div>
                <div class="mt-3 grid gap-2">
                  ${isPortalAdmin ? '<button id="settings-button" type="button" class="app-button-secondary w-full justify-start gap-3" role="menuitem"><span aria-hidden="true">⚙</span><span>Settings</span></button>' : ''}
                  <button id="logout-button" type="button" class="app-button-secondary w-full justify-start gap-3 text-red-600" role="menuitem"><span aria-hidden="true">↪</span><span>Logout</span></button>
                </div>
              </div>
            </div>
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

function setSidebar(open) {
  document
    .querySelector('#sidebar')
    ?.classList.toggle(
      '-translate-x-full',
      !open
    );

  document
    .querySelector(
      '#sidebar-backdrop'
    )
    ?.classList.toggle(
      'hidden',
      !open
    );
}

function updateNetworkStatus() {
  const element =
    document.querySelector(
      '#network-status'
    );

  if (!element) {
    return;
  }

  const online =
    navigator.onLine;

  element.textContent =
    online
      ? 'Online'
      : 'Offline';

  element.className = online
    ? 'hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex'
    : 'hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 sm:inline-flex';
}

function updateRouteUI(route) {
  const manifest =
    appRegistry.getByRoute(
      route
    );

  const label =
    document.querySelector(
      '#current-route-label'
    );

  if (label) {
    label.textContent =
      manifest?.title ||
      route;
  }

  document
    .querySelectorAll('[data-route]')
    .forEach((button) => {
      button.className =
        button.dataset.route === route
          ? 'app-button-primary w-full justify-start'
          : 'app-button-secondary w-full justify-start';
    });
}

function registerRoutes() {
  appRegistry
    .list()
    .forEach((manifest) => {
      router.register(
        manifest.route,
        manifest.loader
      );
    });
}

function createNavigator(container) {
  registerRoutes();

  return async (
    route,
    options = {}
  ) => {
    const manifest =
      appRegistry.getByRoute(
        route
      );

    if (
      !manifest ||
      !permissionEngine.canAccessManifest(
        activeSession,
        manifest
      )
    ) {
      toast.warning(
        'Anda tidak memiliki akses ke aplikasi tersebut.',
        {
          key:
            'permission-app-denied'
        }
      );

      route =
        getDefaultRoute();
    }

    const safeManifest =
      appRegistry.getByRoute(
        route
      );

    const safeRoute =
      safeManifest?.route ||
      getDefaultRoute();

    updateRouteUI(
      safeRoute
    );

    await router.navigate(
      safeRoute,
      {
        container,
        mode: 'portal',
        session:
          activeSession,
        manifest:
          safeManifest,
        internalMenu:
          permissionEngine
            .filterInternalMenu(
              activeSession,
              safeManifest?.internalMenu ||
              []
            ),
        visibleManifests: getVisibleManifests(),
        historyMode:
          options.historyMode ||
          'push'
      }
    );

    setSidebar(false);
  };
}

function bindPortalEvents(navigate) {
  shellAbortController?.abort();

  shellAbortController =
    new AbortController();

  const { signal } =
    shellAbortController;

  document
    .querySelector('#open-sidebar')
    ?.addEventListener(
      'click',
      () => setSidebar(true),
      { signal }
    );

  document
    .querySelector('#close-sidebar')
    ?.addEventListener(
      'click',
      () => setSidebar(false),
      { signal }
    );

  document
    .querySelector(
      '#sidebar-backdrop'
    )
    ?.addEventListener(
      'click',
      () => setSidebar(false),
      { signal }
    );

  document
    .querySelectorAll(
      '[data-route]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => navigate(
          button.dataset.route
        ),
        { signal }
      );
    });

  document
    .querySelector(
      '#open-core-test'
    )
    ?.addEventListener(
      'click',
      async () => {
        const { modal } =
          await import(
            '../core/modal.js'
          );

        const { diagnostics } =
          await import(
            '../core/diagnostics.js'
          );

        modal.open({
          title:
            'Core Diagnostics',
          content: `
            <pre class="max-h-[65vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">${escapeHtml(
              JSON.stringify(
                diagnostics.snapshot(),
                null,
                2
              )
            )}</pre>
          `,
          confirmText: 'Tutup'
        });
      },
      { signal }
    );

  document
    .querySelector(
      '#check-update'
    )
    ?.addEventListener(
      'click',
      async () => {
        if (!pwaRegistration) {
          toast.warning(
            'Service worker belum aktif.'
          );
          return;
        }

        await pwaRegistration.update();

        toast.success(
          'Pemeriksaan update selesai.'
        );
      },
      { signal }
    );

  const profileButton = document.querySelector('#profile-button');
  const profileMenu = document.querySelector('#profile-menu');

  profileButton?.addEventListener('click', () => {
    const willOpen = profileMenu?.classList.contains('hidden');
    profileMenu?.classList.toggle('hidden', !willOpen);
    profileButton.setAttribute('aria-expanded', String(Boolean(willOpen)));
  }, { signal });

  document.addEventListener('click', (event) => {
    if (!profileMenu || !profileButton) return;
    if (!profileMenu.contains(event.target) && !profileButton.contains(event.target)) {
      profileMenu.classList.add('hidden');
      profileButton.setAttribute('aria-expanded', 'false');
    }
  }, { signal });

  document
    .querySelector('#settings-button')
    ?.addEventListener(
      'click',
      async () => {
        profileMenu?.classList.add('hidden');
        profileButton?.setAttribute('aria-expanded', 'false');
        const { openSettings } = await import('../settings/settings-shell.js');
        await openSettings({ session: activeSession, initialTab: 'apps' });
      },
      { signal }
    );

  document
    .querySelector(
      '#logout-button'
    )
    ?.addEventListener(
      'click',
      async () => {
        await logout();
        activeSession = null;
        showLogin();
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
      const route =
        getRouteFromHash();

      if (
        store.getState().route !== route
      ) {
        navigate(
          route,
          {
            historyMode: 'none'
          }
        );
      }
    },
    { signal }
  );
}

async function showAuthenticatedPortal(
  session
) {
  activeSession = session;

  renderPortalShell(session);

  const container =
    document.querySelector(
      '#portal-content'
    );

  const navigate =
    createNavigator(container);

  bindPortalEvents(navigate);
  updateNetworkStatus();

  await navigate(
    getRouteFromHash(),
    {
      historyMode: 'replace'
    }
  );

  getVisibleManifests()
    .filter(
      (manifest) =>
        manifest.route !==
        getRouteFromHash()
    )
    .forEach(
      (manifest) => {
        const preload = () =>
          manifest.loader();

        if (
          'requestIdleCallback' in window
        ) {
          window.requestIdleCallback(
            preload
          );
        } else {
          window.setTimeout(
            preload,
            1000
          );
        }
      }
    );
}

function showLogin() {
  shellAbortController?.abort();
  shellAbortController = null;

  renderLoginView(
    root,
    {
      title:
        'Masuk ke Portal',
      subtitle:
        'Gunakan username dan password Portal.',
      submitText:
        'Masuk',
      onSuccess:
        async (session) => {
          await showAuthenticatedPortal(
            session
          );
        }
    }
  );
}

async function startPortal() {
  root.innerHTML = `
    <div class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
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

  let session = null;

  try {
    session =
      await restoreSession();
  } catch (error) {
    logger.warn(
      'Portal session restore failed',
      {
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

  await showAuthenticatedPortal(
    session
  );
}

async function startPwa() {
  try {
    const result =
      await registerPwa();

    pwaRegistration =
      result?.registration ||
      null;
  } catch (error) {
    logger.warn(
      'PWA registration failed',
      {
        message:
          error.message
      }
    );
  }
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

startPwa();
startPortal();
