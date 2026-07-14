import {
  defineApp
} from '../../sdk/portal-sdk.js';

let mountedContainer = null;

const dashboardApp = defineApp({
  id: 'dashboard',

  async mount(
    container,
    context = {}
  ) {
    mountedContainer = container;

    container.innerHTML = `
      <section class="space-y-4">
        <article class="app-card">
          <p class="text-sm font-semibold text-blue-600">
            Dashboard
          </p>

          <h2 class="mt-1 text-2xl font-bold text-slate-900">
            Portal AZKO Kudus
          </h2>

          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Dashboard sekarang terdaftar melalui Portal SDK
            dan App Manifest Registry.
          </p>
        </article>

        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article class="app-card">
            <p class="text-sm text-slate-500">
              SDK
            </p>

            <p class="mt-1 font-bold text-emerald-600">
              Active
            </p>
          </article>

          <article class="app-card">
            <p class="text-sm text-slate-500">
              Module
            </p>

            <p class="mt-1 font-bold">
              Dashboard
            </p>
          </article>

          <article class="app-card">
            <p class="text-sm text-slate-500">
              Mode
            </p>

            <p class="mt-1 font-bold">
              ${context.mode || 'portal'}
            </p>
          </article>
        </section>
      </section>
    `;

    context.lifecycle?.addCleanup(
      () => {
        mountedContainer = null;
      }
    );
  },

  async refresh() {},

  async pause() {},

  async resume() {},

  async unmount() {
    if (mountedContainer) {
      mountedContainer.innerHTML = '';
    }

    mountedContainer = null;
  }
});

export const {
  mount,
  refresh,
  pause,
  resume,
  unmount
} = dashboardApp;
