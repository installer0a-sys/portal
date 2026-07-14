import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';

let root = null;
let mountedContext = null;

export async function mount(container, context = {}) {
  root = container;
  mountedContext = context;
  const profile = context.profile;
  const standalone = context.mode === 'standalone';

  container.innerHTML = `
    <section class="space-y-4">
      <article class="app-card">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-blue-600">App A</p>
            <h2 class="mt-1 text-2xl font-bold text-slate-900">Modul App A</h2>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Modul yang sama digunakan oleh Portal dan PWA App A mandiri.
            </p>
            <p class="mt-2 text-xs text-slate-500">
              ${profile.user.username} · ${profile.access.appRoles?.appA || 'NONE'}
            </p>
          </div>
          <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            ${standalone ? 'Standalone' : 'Portal SPA'}
          </span>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <button type="button" data-app-a-test class="app-button-primary">
            Tes API App A
          </button>
          ${!standalone ? `
            <button type="button" data-app-a-back class="app-button-secondary">
              Kembali ke Dashboard
            </button>
          ` : ''}
        </div>

        <pre data-app-a-result class="mt-4 min-h-36 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">Belum diuji.</pre>
      </article>
    </section>
  `;

  container.querySelector('[data-app-a-test]').addEventListener('click', async () => {
    const output = container.querySelector('[data-app-a-result]');
    output.textContent = 'Menghubungi App A...';
    try {
      const result = await callApi('appA.ping');
      output.textContent = JSON.stringify(result, null, 2);
      toast.success('App A terhubung.');
    } catch (error) {
      output.textContent = `ERROR: ${error.message}`;
      toast.error(error.message);
    }
  });

  container.querySelector('[data-app-a-back]')?.addEventListener('click', () => {
    context.navigate('dashboard');
  });
}

export async function refresh() {
  const button = root?.querySelector('[data-app-a-test]');
  button?.click();
}

export async function unmount() {
  if (root) root.innerHTML = '';
  root = null;
  mountedContext = null;
}
