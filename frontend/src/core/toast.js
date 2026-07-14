const DEFAULT_DURATION = 3500;
const MAX_VISIBLE = 4;

let container = null;
const activeToasts = new Map();

function ensureContainer() {
  if (
    container &&
    document.body.contains(container)
  ) {
    return container;
  }

  container = document.createElement('div');
  container.id = 'portal-toast-container';
  container.className =
    'fixed right-4 top-4 z-[150] flex w-[min(92vw,380px)] flex-col gap-2';

  document.body.appendChild(container);

  return container;
}

function getStyle(type) {
  const styles = {
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-800',
    error:
      'border-red-200 bg-red-50 text-red-800',
    warning:
      'border-amber-200 bg-amber-50 text-amber-800',
    info:
      'border-blue-200 bg-blue-50 text-blue-800'
  };

  return styles[type] || styles.info;
}

function closeToast(key) {
  const record = activeToasts.get(key);

  if (!record) {
    return;
  }

  window.clearTimeout(record.timer);

  record.element.classList.add(
    'translate-x-4',
    'opacity-0'
  );

  window.setTimeout(() => {
    record.element.remove();
  }, 180);

  activeToasts.delete(key);
}

function trimVisible() {
  while (activeToasts.size > MAX_VISIBLE) {
    const oldestKey =
      activeToasts.keys().next().value;

    closeToast(oldestKey);
  }
}

function show(
  message,
  type = 'info',
  options = {}
) {
  const text = String(message || '').trim();

  if (!text) {
    return () => {};
  }

  const duration = Number(
    options.duration || DEFAULT_DURATION
  );

  const key = String(
    options.key ||
    `${type}:${text}`
  );

  const existing = activeToasts.get(key);

  if (existing) {
    window.clearTimeout(existing.timer);

    existing.element.textContent = text;
    existing.element.className = [
      'rounded-xl border px-4 py-3',
      'text-sm font-medium shadow-lg',
      'transition duration-200',
      getStyle(type)
    ].join(' ');

    existing.timer = window.setTimeout(
      () => closeToast(key),
      duration
    );

    return () => closeToast(key);
  }

  const root = ensureContainer();
  const element = document.createElement('div');

  element.className = [
    'rounded-xl border px-4 py-3',
    'text-sm font-medium shadow-lg',
    'transition duration-200',
    getStyle(type)
  ].join(' ');

  element.textContent = text;
  element.dataset.toastKey = key;

  root.appendChild(element);

  const timer = window.setTimeout(
    () => closeToast(key),
    duration
  );

  activeToasts.set(key, {
    key,
    type,
    element,
    timer,
    createdAt: new Date().toISOString()
  });

  trimVisible();

  return () => closeToast(key);
}

export const toast = {
  success(message, options) {
    return show(message, 'success', options);
  },

  error(message, options) {
    return show(message, 'error', options);
  },

  warning(message, options) {
    return show(message, 'warning', options);
  },

  info(message, options) {
    return show(message, 'info', options);
  },

  close(key) {
    closeToast(String(key || ''));
  },

  clear() {
    [...activeToasts.keys()].forEach(
      closeToast
    );
  },

  snapshot() {
    return {
      count: activeToasts.size,
      active: [...activeToasts.values()].map(
        (item) => ({
          key: item.key,
          type: item.type,
          createdAt: item.createdAt
        })
      )
    };
  }
};
