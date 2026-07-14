let mountedContainer = null;

export async function mount(container) {
  mountedContainer = container;

  container.innerHTML = `
    <section class="space-y-4">
      <article class="app-card">
        <p class="text-sm font-semibold text-blue-600">Dashboard</p>
        <h2 class="mt-1 text-2xl font-bold text-slate-900">
          Portal AZKO Kudus
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Portal berjalan sebagai SPA modular tanpa reload penuh.
        </p>
      </article>
    </section>
  `;
}

export async function refresh() {}

export async function unmount() {
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
  }
  mountedContainer = null;
}
