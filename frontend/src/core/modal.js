let modalRoot = null;

function ensureModalRoot() {
  if (modalRoot) return modalRoot;

  modalRoot = document.createElement('div');
  modalRoot.id = 'portal-modal-root';
  document.body.appendChild(modalRoot);

  return modalRoot;
}

function close() {
  if (!modalRoot) return;

  modalRoot.innerHTML = '';
  document.body.classList.remove('overflow-hidden');
}

function open({
  title = 'Informasi',
  content = '',
  confirmText = 'Tutup',
  onConfirm = null
} = {}) {
  const root = ensureModalRoot();

  root.innerHTML = `
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4"
      data-modal-backdrop
    >
      <section
        class="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-modal-title"
      >
        <div class="flex items-start justify-between gap-4">
          <h2 id="portal-modal-title" class="text-lg font-bold text-slate-900">
            ${title}
          </h2>

          <button
            type="button"
            data-modal-close
            class="app-button-secondary min-h-9 px-3"
            aria-label="Tutup modal"
          >
            ×
          </button>
        </div>

        <div class="mt-4 text-sm leading-6 text-slate-600">
          ${content}
        </div>

        <div class="mt-6 flex justify-end">
          <button type="button" data-modal-confirm class="app-button-primary">
            ${confirmText}
          </button>
        </div>
      </section>
    </div>
  `;

  document.body.classList.add('overflow-hidden');

  const backdrop = root.querySelector('[data-modal-backdrop]');
  const dialog = root.querySelector('[role="dialog"]');

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  root.querySelector('[data-modal-close]').addEventListener('click', close);

  root.querySelector('[data-modal-confirm]').addEventListener('click', async () => {
    if (typeof onConfirm === 'function') {
      await onConfirm();
    }

    close();
  });
}

export const modal = { open, close };
