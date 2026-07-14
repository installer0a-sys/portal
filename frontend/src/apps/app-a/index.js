import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';

let mountedContainer = null;
let abortController = null;

export async function mount(container, context = {}) {
  mountedContainer = container;
  abortController = new AbortController();

  container.innerHTML = `
    <section class="space-y-4">
      <article class="app-card">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-blue-600">App A</p>
            <h2 class="mt-1 text-2xl font-bold text-slate-900">
              Modul App A
            </h2>
            <p class="mt-2 text-sm text-slate-600">
              Modul yang sama dipakai di Portal dan standalone App A.
            </p>
          </div>

          <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            ${context.mode === 'standalone' ? 'Standalone' : 'Portal'}
          </span>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <button data-app-a-test type="button" class="app-button-primary">
            Tes API App A
          </button>

          ${
            context.mode === 'portal'
              ? `
                <button data-app-a-back type="button" class="app-button-secondary">
                  Kembali ke Dashboard
                </button>
              `
              : ''
          }
        </div>

        <pre data-app-a-result class="mt-4 min-h-32 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">Belum diuji.</pre>
      </article>
    </section>
  `;

  const { signal } = abortController;

  container
    .querySelector('[data-app-a-test]')
    ?.addEventListener(
      'click',
      async () => {
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
      },
      { signal }
    );

  container
    .querySelector('[data-app-a-back]')
    ?.addEventListener(
      'click',
      () => {
        context.navigate?.('dashboard', {
          historyMode: 'push'
        });
      },
      { signal }
    );
}

export async function refresh() {}

export async function unmount() {
  abortController?.abort();
  abortController = null;

  if (mountedContainer) {
    mountedContainer.innerHTML = '';
  }

  mountedContainer = null;
}
