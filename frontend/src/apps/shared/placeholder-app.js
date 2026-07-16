import { defineApp } from '../../sdk/portal-sdk.js';

export function createPlaceholderApp({ id, title, description }) {
  let mountedContainer = null;
  const app = defineApp({
    id,
    async mount(container, context = {}) {
      mountedContainer = container;
      container.innerHTML = `
        <section class="space-y-4">
          <article class="app-card">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-sm font-semibold text-blue-600">${title}</p>
                <h2 class="mt-1 text-2xl font-bold text-slate-900">Pondasi ${title} siap</h2>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">${description}</p>
              </div>
              <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Dalam pengembangan</span>
            </div>
            <div class="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Modul dimuat secara lazy-load. Isi data dan CRUD akan ditambahkan setelah layanan data generik selesai.
            </div>
            ${context.mode === 'portal' ? '<button data-back type="button" class="app-button-secondary mt-4">Kembali ke Dashboard</button>' : ''}
          </article>
        </section>`;
      const back = container.querySelector('[data-back]');
      if (back) context.lifecycle?.listen(back, 'click', () => context.navigate?.('dashboard', { historyMode: 'push' }));
      context.lifecycle?.addCleanup(() => { mountedContainer = null; });
    },
    async refresh() {}, async pause() {}, async resume() {},
    async unmount() { if (mountedContainer) mountedContainer.innerHTML = ''; mountedContainer = null; }
  });
  return app;
}
