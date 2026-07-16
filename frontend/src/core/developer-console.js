import { diagnostics } from './diagnostics.js';
import { logger } from './logger.js';

let root = null;
let activeTab = 'system';
let refreshTimer = null;

const tabs = [
  { id: 'system', title: 'System' },
  { id: 'lifecycle', title: 'Lifecycle' },
  { id: 'queue', title: 'Queue' },
  { id: 'cache', title: 'Cache' },
  { id: 'logs', title: 'Logs' },
  { id: 'raw', title: 'Raw JSON' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatBytes(value) {
  const bytes = Number(value || 0);

  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / 1024 ** index).toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
}

function formatDuration(value) {
  const ms = Number(value || 0);

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}

function renderBadge(text, tone = 'slate') {
  const styles = {
    green:
      'bg-emerald-100 text-emerald-700',
    red:
      'bg-red-100 text-red-700',
    amber:
      'bg-amber-100 text-amber-700',
    blue:
      'bg-blue-100 text-blue-700',
    slate:
      'bg-slate-100 text-slate-700'
  };

  return `
    <span class="rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone] || styles.slate}">
      ${escapeHtml(text)}
    </span>
  `;
}

function renderMetric(label, value, extra = '') {
  return `
    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        ${escapeHtml(label)}
      </p>

      <p class="mt-2 break-words text-sm font-bold text-slate-900">
        ${escapeHtml(value)}
      </p>

      ${
        extra
          ? `
            <p class="mt-1 text-xs text-slate-500">
              ${escapeHtml(extra)}
            </p>
          `
          : ''
      }
    </div>
  `;
}

function renderSystem(snapshot) {
  const memory = snapshot.memory || {};
  const cache = snapshot.cache || {};
  const permission = snapshot.permission || {};
  const sdk = snapshot.sdk || {};
  const registry = snapshot.registry || {};

  return `
    <section class="space-y-4">
      <div class="flex flex-wrap gap-2">
        ${renderBadge(
          snapshot.networkOnline
            ? 'Online'
            : 'Offline',
          snapshot.networkOnline
            ? 'green'
            : 'amber'
        )}

        ${renderBadge(
          snapshot.pendingRequests === 0
            ? 'No pending request'
            : `${snapshot.pendingRequests} pending`,
          snapshot.pendingRequests === 0
            ? 'green'
            : 'amber'
        )}

        ${renderBadge(
          snapshot.lastError
            ? 'Last error available'
            : 'No runtime error',
          snapshot.lastError
            ? 'red'
            : 'green'
        )}
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${renderMetric(
          'Route',
          snapshot.route || '-'
        )}

        ${renderMetric(
          'SDK Version',
          sdk.version || '-'
        )}

        ${renderMetric(
          'Portal Role',
          permission.portalRole || 'NONE'
        )}

        ${renderMetric(
          'Registered Apps',
          String(registry.count || 0)
        )}

        ${renderMetric(
          'Pending Requests',
          String(snapshot.pendingRequests || 0)
        )}

        ${renderMetric(
          'Persistent Cache',
          String(cache.persistentCount || 0)
        )}

        ${renderMetric(
          'Memory Cache',
          String(cache.memoryCount || 0)
        )}

        ${renderMetric(
          'Uptime',
          formatDuration(snapshot.uptimeMs)
        )}

        ${renderMetric(
          'Used JS Heap',
          formatBytes(memory.usedJsHeapSize)
        )}

        ${renderMetric(
          'Total JS Heap',
          formatBytes(memory.totalJsHeapSize)
        )}

        ${renderMetric(
          'Viewport',
          `${snapshot.viewport?.width || 0} × ${snapshot.viewport?.height || 0}`
        )}

        ${renderMetric(
          'Service Worker',
          snapshot.serviceWorkerSupported
            ? 'Supported'
            : 'Not supported'
        )}
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm font-bold text-slate-900">
          Active cache context
        </p>

        <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-xs text-slate-500">User</dt>
            <dd class="mt-1 break-all font-semibold">
              ${escapeHtml(cache.context?.userId || 'anonymous')}
            </dd>
          </div>

          <div>
            <dt class="text-xs text-slate-500">Permission signature</dt>
            <dd class="mt-1 break-all font-semibold">
              ${escapeHtml(
                cache.context?.permissionSignature || 'anonymous'
              )}
            </dd>
          </div>

          <div>
            <dt class="text-xs text-slate-500">Session version</dt>
            <dd class="mt-1 break-all font-semibold">
              ${escapeHtml(cache.context?.sessionVersion || '0')}
            </dd>
          </div>
        </dl>
      </div>

      ${
        snapshot.lastError
          ? `
            <div class="rounded-xl border border-red-200 bg-red-50 p-4">
              <p class="text-sm font-bold text-red-700">
                Last Error
              </p>

              <pre class="mt-3 overflow-auto text-xs text-red-800">${escapeHtml(
                JSON.stringify(snapshot.lastError, null, 2)
              )}</pre>
            </div>
          `
          : ''
      }
    </section>
  `;
}

function renderLifecycle(snapshot) {
  const lifecycle = snapshot.lifecycle || {};
  const active = lifecycle.active;
  const history = Array.isArray(lifecycle.history)
    ? [...lifecycle.history].reverse()
    : [];

  return `
    <section class="space-y-4">
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-slate-900">
              Active Module
            </p>

            <p class="mt-1 text-sm text-slate-600">
              ${escapeHtml(active?.name || 'Tidak ada modul aktif')}
            </p>
          </div>

          ${renderBadge(
            active?.status || 'inactive',
            active?.status === 'active'
              ? 'green'
              : active?.status === 'error'
                ? 'red'
                : 'slate'
          )}
        </div>

        ${
          active
            ? `
              <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt class="text-xs text-slate-500">Mounted</dt>
                  <dd class="mt-1 font-semibold">
                    ${escapeHtml(active.mountedAt || '-')}
                  </dd>
                </div>

                <div>
                  <dt class="text-xs text-slate-500">Refresh count</dt>
                  <dd class="mt-1 font-semibold">
                    ${escapeHtml(active.refreshCount || 0)}
                  </dd>
                </div>

                <div>
                  <dt class="text-xs text-slate-500">Cleanup callbacks</dt>
                  <dd class="mt-1 font-semibold">
                    ${escapeHtml(active.scope?.cleanupCallbacks || 0)}
                  </dd>
                </div>
              </dl>
            `
            : ''
        }
      </div>

      <div class="rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <p class="text-sm font-bold text-slate-900">
            Lifecycle History
          </p>
        </div>

        <div class="max-h-[52vh] overflow-auto">
          ${
            history.length
              ? history
                  .map(
                    (item) => `
                      <div class="border-b border-slate-100 px-4 py-3 last:border-b-0">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p class="text-sm font-semibold text-slate-900">
                              ${escapeHtml(item.type || '-')}
                              ·
                              ${escapeHtml(item.name || '-')}
                            </p>

                            <p class="mt-1 text-xs text-slate-500">
                              ${escapeHtml(item.timestamp || '')}
                            </p>
                          </div>

                          ${
                            item.durationMs !== undefined
                              ? renderBadge(
                                  formatDuration(item.durationMs),
                                  'blue'
                                )
                              : ''
                          }
                        </div>
                      </div>
                    `
                  )
                  .join('')
              : `
                <p class="p-4 text-sm text-slate-500">
                  Belum ada lifecycle history.
                </p>
              `
          }
        </div>
      </div>
    </section>
  `;
}

function renderQueue(snapshot) {
  const queue = snapshot.queue || {};
  const running = Array.isArray(queue.running)
    ? queue.running
    : [];
  const history = Array.isArray(queue.history)
    ? [...queue.history].reverse()
    : [];

  return `
    <section class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2">
        ${renderMetric(
          'Running Tasks',
          String(running.length)
        )}

        ${renderMetric(
          'History Items',
          String(history.length)
        )}
      </div>

      <div class="rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <p class="text-sm font-bold text-slate-900">
            Queue History
          </p>
        </div>

        <div class="max-h-[58vh] overflow-auto">
          ${
            history.length
              ? history
                  .map(
                    (item) => `
                      <div class="border-b border-slate-100 px-4 py-3 last:border-b-0">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p class="text-sm font-semibold text-slate-900">
                              ${escapeHtml(item.label || item.id || '-')}
                            </p>

                            <p class="mt-1 text-xs text-slate-500">
                              ${escapeHtml(item.timestamp || '')}
                            </p>
                          </div>

                          <div class="flex items-center gap-2">
                            ${renderBadge(
                              item.status || '-',
                              item.status === 'completed'
                                ? 'green'
                                : item.status === 'failed'
                                  ? 'red'
                                  : item.status === 'started'
                                    ? 'blue'
                                    : 'slate'
                            )}

                            ${
                              item.durationMs !== undefined
                                ? renderBadge(
                                    formatDuration(item.durationMs),
                                    'slate'
                                  )
                                : ''
                            }
                          </div>
                        </div>

                        ${
                          item.error
                            ? `
                              <p class="mt-2 text-xs text-red-600">
                                ${escapeHtml(item.error)}
                              </p>
                            `
                            : ''
                        }
                      </div>
                    `
                  )
                  .join('')
              : `
                <p class="p-4 text-sm text-slate-500">
                  Belum ada queue history.
                </p>
              `
          }
        </div>
      </div>
    </section>
  `;
}

function renderCache(snapshot) {
  const cache = snapshot.cache || {};
  const items = Array.isArray(cache.items)
    ? cache.items
    : [];

  return `
    <section class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-3">
        ${renderMetric(
          'Persistent Items',
          String(cache.persistentCount || 0)
        )}

        ${renderMetric(
          'Memory Items',
          String(cache.memoryCount || 0)
        )}

        ${renderMetric(
          'Active User',
          cache.context?.userId || 'anonymous'
        )}
      </div>

      <div class="rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <p class="text-sm font-bold text-slate-900">
            Cache Index
          </p>
        </div>

        <div class="max-h-[58vh] overflow-auto">
          ${
            items.length
              ? items
                  .map(
                    (item) => `
                      <div class="border-b border-slate-100 px-4 py-3 last:border-b-0">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p class="text-sm font-semibold text-slate-900">
                              ${escapeHtml(item.appId || '-')}
                              /
                              ${escapeHtml(item.namespace || '-')}
                            </p>

                            <p class="mt-1 break-all text-xs text-slate-500">
                              ${escapeHtml(item.permissionSignature || '-')}
                            </p>
                          </div>

                          ${renderBadge(
                            item.expired ? 'Expired' : 'Active',
                            item.expired ? 'red' : 'green'
                          )}
                        </div>
                      </div>
                    `
                  )
                  .join('')
              : `
                <p class="p-4 text-sm text-slate-500">
                  Cache index masih kosong.
                </p>
              `
          }
        </div>
      </div>
    </section>
  `;
}

function renderLogs(snapshot) {
  const logs = Array.isArray(snapshot.logs)
    ? [...snapshot.logs].reverse()
    : [];

  return `
    <section class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <p class="text-sm font-bold text-slate-900">
          Runtime Logs
        </p>

        ${renderBadge(
          `${logs.length} entries`,
          'blue'
        )}
      </div>

      <div class="max-h-[66vh] overflow-auto">
        ${
          logs.length
            ? logs
                .map(
                  (item) => `
                    <div class="border-b border-slate-100 px-4 py-3 last:border-b-0">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <p class="text-sm font-semibold text-slate-900">
                          ${escapeHtml(item.message || '-')}
                        </p>

                        ${renderBadge(
                          item.level || 'info',
                          item.level === 'error'
                            ? 'red'
                            : item.level === 'warn'
                              ? 'amber'
                              : 'blue'
                        )}
                      </div>

                      <p class="mt-1 text-xs text-slate-500">
                        ${escapeHtml(item.timestamp || '')}
                      </p>

                      ${
                        item.context &&
                        Object.keys(item.context).length
                          ? `
                            <pre class="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">${escapeHtml(
                              JSON.stringify(item.context, null, 2)
                            )}</pre>
                          `
                          : ''
                      }
                    </div>
                  `
                )
                .join('')
            : `
              <p class="p-4 text-sm text-slate-500">
                Belum ada runtime log.
              </p>
            `
        }
      </div>
    </section>
  `;
}

function renderRaw(snapshot) {
  return `
    <pre class="max-h-[72vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">${escapeHtml(
      JSON.stringify(snapshot, null, 2)
    )}</pre>
  `;
}

function renderContent(snapshot) {
  switch (activeTab) {
    case 'lifecycle':
      return renderLifecycle(snapshot);

    case 'queue':
      return renderQueue(snapshot);

    case 'cache':
      return renderCache(snapshot);

    case 'logs':
      return renderLogs(snapshot);

    case 'raw':
      return renderRaw(snapshot);

    case 'system':
    default:
      return renderSystem(snapshot);
  }
}

function renderTabs() {
  return tabs
    .map(
      (tab) => `
        <button
          type="button"
          data-dev-tab="${tab.id}"
          class="${
            activeTab === tab.id
              ? 'rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white'
              : 'rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100'
          }"
        >
          ${escapeHtml(tab.title)}
        </button>
      `
    )
    .join('');
}

function getScrollableElements(container) {
  if (!container) {
    return [];
  }

  return [container, ...container.querySelectorAll('*')]
    .filter((element) => {
      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;

      return (
        element.scrollHeight > element.clientHeight &&
        ['auto', 'scroll'].includes(overflowY)
      ) || (
        element.scrollWidth > element.clientWidth &&
        ['auto', 'scroll'].includes(overflowX)
      );
    });
}

function captureScrollState(container) {
  return getScrollableElements(container).map((element, index) => ({
    index,
    top: element.scrollTop,
    left: element.scrollLeft
  }));
}

function restoreScrollState(container, state = []) {
  const elements = getScrollableElements(container);

  state.forEach((position) => {
    const element = elements[position.index];

    if (!element) {
      return;
    }

    element.scrollTop = position.top;
    element.scrollLeft = position.left;
  });
}

function updateActiveTabStyles() {
  root
    ?.querySelectorAll('[data-dev-tab]')
    .forEach((button) => {
      const isActive = button.dataset.devTab === activeTab;

      button.className = isActive
        ? 'rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white'
        : 'rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100';
    });
}

function refreshContent({ preserveScroll = true } = {}) {
  if (!root) {
    return;
  }

  const content = root.querySelector('[data-dev-content]');

  if (!content) {
    return;
  }

  const scrollState = preserveScroll
    ? captureScrollState(content)
    : [];

  content.innerHTML = renderContent(diagnostics.snapshot());
  updateActiveTabStyles();

  if (preserveScroll) {
    window.requestAnimationFrame(() => {
      restoreScrollState(content, scrollState);
    });
  }
}

function renderShell() {
  if (!root) {
    return;
  }

  const panel = root.querySelector('[data-dev-panel]');

  if (!panel) {
    return;
  }

  panel.innerHTML = `
    <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Portal Engine
          </p>

          <h2 class="mt-1 text-lg font-bold text-slate-900">
            Developer Console
          </h2>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            data-dev-refresh
            class="app-button-secondary min-h-9 px-3 text-xs"
          >
            Refresh
          </button>

          <button
            type="button"
            data-dev-close
            class="app-button-secondary min-h-9 px-3 text-xs"
          >
            Tutup
          </button>
        </div>
      </header>

      <nav class="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2">
        ${renderTabs()}
      </nav>

      <main data-dev-content class="min-h-0 flex-1 overflow-auto p-4"></main>

      <footer class="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        Data diperbarui otomatis tanpa mengubah posisi scroll · Ctrl+Shift+D toggle · Esc tutup
      </footer>
    </div>
  `;

  bindPanelEvents();
  refreshContent({ preserveScroll: false });
}

function bindPanelEvents() {
  root
    ?.querySelector('[data-dev-close]')
    ?.addEventListener(
      'click',
      () => developerConsole.close()
    );

  root
    ?.querySelector('[data-dev-refresh]')
    ?.addEventListener(
      'click',
      () => refreshContent({ preserveScroll: true })
    );

  root
    ?.querySelectorAll('[data-dev-tab]')
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          activeTab = button.dataset.devTab || 'system';
          refreshContent({ preserveScroll: false });
        }
      );
    });
}

function ensureRoot() {
  if (
    root &&
    document.body.contains(root)
  ) {
    return root;
  }

  root = document.createElement('div');
  root.id = 'portal-developer-console';
  root.className =
    'fixed inset-0 z-[300] hidden bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5';

  root.innerHTML = `
    <div
      data-dev-panel
      class="mx-auto h-full max-w-7xl"
    ></div>
  `;

  root.addEventListener(
    'click',
    (event) => {
      if (event.target === root) {
        developerConsole.close();
      }
    }
  );

  document.body.appendChild(root);

  return root;
}

export const developerConsole = {
  open(tab = 'system') {
    activeTab = tabs.some(
      (item) => item.id === tab
    )
      ? tab
      : 'system';

    const element = ensureRoot();

    element.classList.remove('hidden');
    document.documentElement.classList.add('overflow-hidden');

    renderShell();

    window.clearInterval(refreshTimer);

    refreshTimer = window.setInterval(
      () => refreshContent({ preserveScroll: true }),
      2500
    );

    logger.info('Developer Console opened', {
      tab: activeTab
    });
  },

  close() {
    if (!root) {
      return;
    }

    root.classList.add('hidden');
    document.documentElement.classList.remove('overflow-hidden');

    window.clearInterval(refreshTimer);
    refreshTimer = null;

    logger.info('Developer Console closed');
  },

  toggle(tab = 'system') {
    const element = ensureRoot();

    if (element.classList.contains('hidden')) {
      this.open(tab);
    } else {
      this.close();
    }
  },

  isOpen() {
    return Boolean(
      root &&
      !root.classList.contains('hidden')
    );
  },

  getActiveTab() {
    return activeTab;
  }
};
