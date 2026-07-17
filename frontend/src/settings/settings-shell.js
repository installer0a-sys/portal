import { getPortalRole } from '../core/access.js';

let root = null;
let abortController = null;
let activeTab = 'users';
let sessionRef = null;

const tabs = [
  { id: 'users', label: 'Management User' },
  { id: 'apps', label: 'Management App' },
  { id: 'logs', label: 'Logs' },
  { id: 'system', label: 'System' }
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
      <section class="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-slate-50 sm:inset-3 sm:rounded-[28px] sm:border sm:border-white/60 sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="flex min-h-16 items-center border-b border-slate-200 bg-white px-5 sm:px-7">
          <h2 id="settings-title" class="text-xl font-bold text-slate-900">Settings</h2>
          <button type="button" data-settings-close class="ml-auto p-2 text-2xl leading-none text-slate-500 transition hover:text-slate-900" aria-label="Tutup Settings">×</button>
        </header>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[220px_1fr]">
          <aside class="shrink-0 border-b border-slate-200 bg-white p-3 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-4">
            <nav class="flex gap-2 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible" aria-label="Menu Settings">
              ${tabs.map((tab) => `<button type="button" data-settings-tab="${tab.id}" class="min-w-max rounded-xl px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${tab.id === activeTab ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'}">${escapeHtml(tab.label)}</button>`).join('')}
            </nav>
          </aside>
          <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6" id="settings-content" tabindex="0">
            <h3 class="mb-5 text-xl font-bold text-slate-900">${escapeHtml(current.label)}</h3>
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

export async function openSettings({ session, initialTab = 'users' } = {}) {
  if (getPortalRole(session).toUpperCase() !== 'ADMIN') return;
  sessionRef = session;
  activeTab = tabs.some((item) => item.id === initialTab) ? initialTab : 'users';
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
