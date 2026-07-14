let root = null;

export async function mount(container, context) {
  root = container;
  const profile = context.profile;

  container.innerHTML = `
    <section class="grid gap-4 lg:grid-cols-3">
      <article class="app-card lg:col-span-2">
        <p class="text-sm font-semibold text-blue-600">Dashboard</p>
        <h2 class="mt-2 text-2xl font-bold text-slate-900">Portal Core V3</h2>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          Portal sekarang memakai SPA Router. Perpindahan ke App A tidak
          memuat ulang halaman dan tidak memvalidasi sesi ulang.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          ${context.can('appA.access') ? `
            <button type="button" data-open-app-a class="app-button-primary">
              Buka App A
            </button>
          ` : ''}
          <button type="button" data-open-diagnostics class="app-button-secondary">
            Buka Core Test
          </button>
        </div>
      </article>

      <aside class="app-card">
        <h3 class="text-sm font-bold text-slate-900">Access information</h3>
        <dl class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-slate-500">Portal role</dt>
            <dd class="font-semibold">${profile.access.portalRole || 'NONE'}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-slate-500">App A role</dt>
            <dd class="font-semibold">${profile.access.appRoles?.appA || 'NONE'}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-slate-500">Current route</dt>
            <dd class="font-semibold">dashboard</dd>
          </div>
        </dl>
      </aside>
    </section>

    <section class="mt-4 app-card">
      <h3 class="text-lg font-bold text-slate-900">Permissions</h3>
      <div class="mt-4 flex flex-wrap gap-2">
        ${(profile.access.permissions || []).map((permission) => `
          <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            ${permission}
          </span>
        `).join('')}
      </div>
    </section>
  `;

  container.querySelector('[data-open-app-a]')?.addEventListener('click', () => {
    context.navigate('appA');
  });

  container.querySelector('[data-open-diagnostics]')?.addEventListener('click', () => {
    context.openDiagnostics();
  });
}

export async function refresh() {}

export async function unmount() {
  if (root) root.innerHTML = '';
  root = null;
}
