import { getPortalRole } from '../core/access.js';

let root = null;
let abortController = null;
let activeTab = 'apps';
let sessionRef = null;

const tabs = [
  { id: 'users', label: 'Management User', description: 'Akun, portal role, dan akses aplikasi.' },
  { id: 'apps', label: 'Management App', description: 'Registry aplikasi dan sumber Spreadsheet.' },
  { id: 'logs', label: 'Logs', description: 'Aktivitas user, audit, error, dan sistem.' },
  { id: 'system', label: 'System', description: 'Status portal, cache, dan versi.' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderShell() {
  const current = tabs.find((item) => item.id === activeTab) || tabs[0];
  root.innerHTML = `
    <div class="fixed inset-0 z-[120] bg-slate-950/50 backdrop-blur-sm" data-settings-backdrop>
      <section class="absolute inset-0 flex flex-col overflow-hidden bg-slate-50 sm:inset-3 sm:rounded-[28px] sm:border sm:border-white/60 sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div class="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm">⚙</div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Portal Admin</p>
            <h2 id="settings-title" class="truncate text-lg font-bold text-slate-900">Settings</h2>
          </div>
          <span class="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">Portal role: ${escapeHtml(getPortalRole(sessionRef))}</span>
          <button type="button" data-settings-close class="app-button-secondary min-h-10 px-3" aria-label="Tutup Settings">×</button>
        </header>

        <div class="min-h-0 flex-1 lg:grid lg:grid-cols-[270px_1fr]">
          <aside class="border-b border-slate-200 bg-white p-3 lg:border-b-0 lg:border-r lg:p-4">
            <nav class="flex gap-2 overflow-x-auto lg:block lg:space-y-2" aria-label="Menu Settings">
              ${tabs.map((tab) => `
                <button type="button" data-settings-tab="${tab.id}" class="min-w-max rounded-2xl px-4 py-3 text-left transition lg:w-full ${tab.id === activeTab ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}">
                  <span class="block text-sm font-bold">${escapeHtml(tab.label)}</span>
                  <span class="mt-1 hidden text-xs ${tab.id === activeTab ? 'text-blue-100' : 'text-slate-500'} lg:block">${escapeHtml(tab.description)}</span>
                </button>`).join('')}
            </nav>
          </aside>

          <main class="min-h-0 overflow-auto p-4 sm:p-6" id="settings-content">
            <div class="mb-5">
              <h3 class="text-xl font-bold text-slate-900">${escapeHtml(current.label)}</h3>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(current.description)}</p>
            </div>
            <div id="settings-tab-content"></div>
          </main>
        </div>
      </section>
    </div>`;
}

async function loadTab() {
  const target = root?.querySelector('#settings-tab-content');
  if (!target) return;
  target.innerHTML = '<div class="app-card animate-pulse text-sm text-slate-500">Memuat modul...</div>';

  const modules = {
    apps: () => import('./tabs/apps.js'),
    users: () => import('./tabs/users.js'),
    logs: () => import('./tabs/logs.js'),
    system: () => import('./tabs/system.js')
  };

  const module = await modules[activeTab]();
  await module.mount(target, { session: sessionRef });
}

function bind() {
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;

  root.querySelector('[data-settings-close]')?.addEventListener('click', closeSettings, { signal });
  root.querySelector('[data-settings-backdrop]')?.addEventListener('click', (event) => {
    if (event.target.matches('[data-settings-backdrop]')) closeSettings();
  }, { signal });
  root.querySelectorAll('[data-settings-tab]').forEach((button) => {
    button.addEventListener('click', async () => {
      activeTab = button.dataset.settingsTab;
      renderShell();
      bind();
      await loadTab();
    }, { signal });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettings();
  }, { signal });
}

export async function openSettings({ session, initialTab = 'apps' } = {}) {
  if (getPortalRole(session).toUpperCase() !== 'ADMIN') return;
  sessionRef = session;
  activeTab = tabs.some((item) => item.id === initialTab) ? initialTab : 'apps';
  root = document.createElement('div');
  root.id = 'portal-settings-root';
  document.body.appendChild(root);
  document.body.classList.add('overflow-hidden');
  renderShell();
  bind();
  await loadTab();
}

export function closeSettings() {
  abortController?.abort();
  root?.remove();
  root = null;
  sessionRef = null;
  document.body.classList.remove('overflow-hidden');
}
