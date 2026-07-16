import { defineApp } from '../../sdk/portal-sdk.js';

let mountedContainer = null;

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

const dashboardApp = defineApp({
  id: 'dashboard',
  async mount(container, context = {}) {
    mountedContainer = container;
    const apps = (context.visibleManifests || []).filter((item) => item.id !== 'dashboard');
    container.innerHTML = `
      <section class="space-y-5">
        <article class="overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
          <p class="text-sm font-semibold text-blue-300">Portal Azko Kudus Sudirman</p>
          <h2 class="mt-2 text-2xl font-bold sm:text-3xl">Selamat datang, ${escapeHtml(context.session?.user?.username || 'User')}</h2>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Pilih aplikasi yang dibutuhkan. Setiap modul dimuat saat dibuka agar portal tetap ringan dan perpindahan berikutnya menjadi cepat.</p>
        </article>

        <div class="flex items-center justify-between gap-4">
          <div><h3 class="text-lg font-bold text-slate-900">Aplikasi</h3><p class="text-sm text-slate-500">${apps.length} aplikasi tersedia untuk akun ini.</p></div>
        </div>

        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          ${apps.map((app) => `
            <button type="button" data-open-app="${escapeHtml(app.route)}" class="group app-card text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
              <div class="flex items-start justify-between gap-4">
                <span class="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-sm font-bold text-blue-700">${escapeHtml(app.shortTitle).slice(0,2).toUpperCase()}</span>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">v${escapeHtml(app.version)}</span>
              </div>
              <h4 class="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-700">${escapeHtml(app.title)}</h4>
              <p class="mt-2 min-h-10 text-sm leading-5 text-slate-600">${escapeHtml(app.description)}</p>
              <span class="mt-4 inline-flex text-sm font-semibold text-blue-700">Buka aplikasi →</span>
            </button>`).join('') || '<article class="app-card text-sm text-slate-600">Belum ada aplikasi yang dapat diakses.</article>'}
        </section>
      </section>`;

    container.querySelectorAll('[data-open-app]').forEach((button) => {
      context.lifecycle?.listen(button, 'click', () => context.navigate?.(button.dataset.openApp, { historyMode: 'push' }));
    });
    context.lifecycle?.addCleanup(() => { mountedContainer = null; });
  },
  async refresh() {}, async pause() {}, async resume() {},
  async unmount() { if (mountedContainer) mountedContainer.innerHTML = ''; mountedContainer = null; }
});

export const { mount, refresh, pause, resume, unmount } = dashboardApp;
