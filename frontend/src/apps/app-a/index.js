import {
  defineApp
} from '../../sdk/portal-sdk.js';
import {
  queueManager
} from '../../core/queue.js';
import { callApi } from '../../core/api.js';
import {
  eventBus
} from '../../core/event-bus.js';

let mountedContainer = null;

const appA = defineApp({
  id: 'appA',

  async mount(
    container,
    context = {}
  ) {
    mountedContainer = container;

    container.innerHTML = `
      <section class="space-y-4">
        <article class="app-card">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-blue-600">
                App A
              </p>

              <h2 class="mt-1 text-2xl font-bold text-slate-900">
                Modul App A
              </h2>

              <p class="mt-2 text-sm text-slate-600">
                App A menggunakan Portal Event Bus untuk mengumumkan hasil operasi.
              </p>
            </div>

            <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              ${
                context.mode === 'standalone'
                  ? 'Standalone'
                  : 'Portal'
              }
            </span>
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <button
              data-app-a-test
              type="button"
              class="app-button-primary"
            >
              Tes API App A
            </button>

            ${
              context.mode === 'portal'
                ? `
                  <button
                    data-app-a-back
                    type="button"
                    class="app-button-secondary"
                  >
                    Kembali ke Dashboard
                  </button>
                `
                : ''
            }
          </div>

          <pre
            data-app-a-result
            class="mt-4 min-h-32 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100"
          >Belum diuji.</pre>
        </article>
      </section>
    `;

    const testButton =
      container.querySelector(
        '[data-app-a-test]'
      );

    const output =
      container.querySelector(
        '[data-app-a-result]'
      );

    context.lifecycle?.listen(
      testButton,
      'click',
      async () => {
        if (
          queueManager.isRunning(
            'appA.ping'
          )
        ) {
          return;
        }

        testButton.disabled = true;
        testButton.textContent =
          'Menghubungkan...';

        output.textContent =
          'Menghubungi App A...';

        try {
          const result =
            await queueManager.run({
              id: 'appA.ping',
              label:
                'Tes koneksi App A',
              mode: 'drop',
              successMessage: '',
              errorMessage:
                'App A gagal terhubung.',
              task: () =>
                callApi(
                  'appA.ping',
                  {},
                  {
                    deduplicate: true
                  }
                )
            });

          output.textContent =
            JSON.stringify(
              result,
              null,
              2
            );

          await eventBus.emit(
            'appA.ping.completed',
            {
              result,
              appId: 'appA'
            },
            {
              source:
                'appA'
            }
          );

          await eventBus.emit(
            'portal.notification.success',
            {
              message:
                'App A terhubung.',
              key:
                'appA-ping-success'
            },
            {
              source:
                'appA'
            }
          );
        } catch (error) {
          output.textContent =
            `ERROR: ${error.message}`;

          await eventBus.emit(
            'appA.ping.failed',
            {
              message:
                error.message,
              appId:
                'appA'
            },
            {
              source:
                'appA'
            }
          );
        } finally {
          testButton.disabled = false;
          testButton.textContent =
            'Tes API App A';
        }
      }
    );

    const backButton =
      container.querySelector(
        '[data-app-a-back]'
      );

    if (backButton) {
      context.lifecycle?.listen(
        backButton,
        'click',
        () => {
          context.navigate?.(
            'dashboard',
            {
              historyMode: 'push'
            }
          );
        }
      );
    }

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
} = appA;
