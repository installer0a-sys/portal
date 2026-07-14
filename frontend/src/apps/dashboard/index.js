let mountedContainer = null;

export async function mount(container) {
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
          Portal Core V3 aktif. Aplikasi dimuat sebagai modul tanpa
          memuat ulang seluruh halaman.
        </p>
      </article>

      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article class="app-card">
          <p class="text-sm text-slate-500">
            Frontend
          </p>

          <p class="mt-1 font-bold text-slate-900">
            Vite + Tailwind CSS
          </p>
        </article>

        <article class="app-card">
          <p class="text-sm text-slate-500">
            Navigation
          </p>

          <p class="mt-1 font-bold text-slate-900">
            SPA Router
          </p>
        </article>

        <article class="app-card">
          <p class="text-sm text-slate-500">
            App loading
          </p>

          <p class="mt-1 font-bold text-slate-900">
            Lazy module
          </p>
        </article>
      </section>
    </section>
  `;
}

export async function refresh() {
  // Dashboard belum mempunyai data dinamis.
}

export async function unmount() {
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
  }

  mountedContainer = null;
}
