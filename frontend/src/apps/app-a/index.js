import { defineApp } from '../../sdk/portal-sdk.js';

let host = null;
let activePage = 'dashboard';

const MENU_TITLES = Object.freeze({
  dashboard: 'Dashboard',
  'jadwal-all': 'Jadwal All',
  'jadwal-spv': 'Jadwal SPV',
  'dop-dos': 'DOP DOS',
  'jadwal-lama': 'Jadwal Lama',
  'admin-jadwal': 'Pengaturan Jadwal',
  'admin-karyawan': 'Data Karyawan',
  'admin-roster': 'Pengaturan Roster',
  'admin-libur': 'Data Libur',
  'admin-generate': 'Generate Jadwal',
  'admin-download': 'Download Workschedule'
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clearLegacyAppAStorage() {
  try {
    Object.keys(localStorage)
      .filter((key) =>
        key.startsWith('portal.appA.') ||
        key.startsWith('appA.') ||
        key.includes('jadwal-a542')
      )
      .forEach((key) => localStorage.removeItem(key));
  } catch {}
}

function renderEmptyPage() {
  const title = MENU_TITLES[activePage] || 'Jadwal A542';

  host.innerHTML = `
    <section class="grid min-h-[calc(100dvh-170px)] place-items-center">
      <article class="w-full max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-2xl text-slate-500">□</div>
        <h2 class="mt-5 text-xl font-bold text-slate-900">${escapeHtml(title)}</h2>
        <p class="mt-2 text-sm text-slate-500">
          Halaman ini sengaja dikosongkan. Modul Jadwal A542 akan dibuat ulang dari awal.
        </p>
      </article>
    </section>`;
}

const app = defineApp({
  id: 'appA',

  async mount(container, context = {}) {
    host = container;
    clearLegacyAppAStorage();

    activePage =
      context.internalMenu?.find((item) => item.default)?.route ||
      'dashboard';

    document.querySelectorAll('[data-internal-route]').forEach((button) => {
      context.lifecycle?.listen(button, 'click', () => {
        activePage = button.dataset.internalRoute || 'dashboard';
        renderEmptyPage();
      });
    });

    renderEmptyPage();
  },

  async refresh() {
    renderEmptyPage();
  },

  async pause() {},
  async resume() {},

  async unmount() {
    if (host) host.innerHTML = '';
    host = null;
  }
});

export const { mount, refresh, pause, resume, unmount } = app;
