let container = null;

function ensureContainer() {
  if (container) return container;

  container = document.createElement('div');
  container.id = 'portal-toast-container';
  container.className =
    'fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2';

  document.body.appendChild(container);

  return container;
}

function show(message, type = 'info', duration = 3500) {
  const root = ensureContainer();

  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800'
  };

  const toast = document.createElement('div');

  toast.className = [
    'rounded-xl border px-4 py-3 text-sm font-medium shadow-lg',
    'transition duration-200',
    styles[type] || styles.info
  ].join(' ');

  toast.textContent = message;
  root.appendChild(toast);

  const close = () => {
    toast.classList.add('translate-x-4', 'opacity-0');

    window.setTimeout(() => {
      toast.remove();
    }, 200);
  };

  window.setTimeout(close, duration);

  return close;
}

export const toast = {
  success(message, duration) {
    return show(message, 'success', duration);
  },

  error(message, duration) {
    return show(message, 'error', duration);
  },

  warning(message, duration) {
    return show(message, 'warning', duration);
  },

  info(message, duration) {
    return show(message, 'info', duration);
  }
};
