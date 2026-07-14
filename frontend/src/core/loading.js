import { logger } from './logger.js';

const active = new Map();
let root = null;

function ensureRoot() {
  if (root && document.body.contains(root)) {
    return root;
  }

  root = document.createElement('div');
  root.id = 'portal-global-loading';
  root.className =
    'pointer-events-none fixed inset-x-0 top-0 z-[140] hidden';

  root.innerHTML = `
    <div class="h-1 w-full overflow-hidden bg-blue-100">
      <div
        data-loading-bar
        class="h-full w-1/3 animate-pulse bg-blue-600"
      ></div>
    </div>
  `;

  document.body.appendChild(root);
  return root;
}

function render() {
  const element = ensureRoot();

  element.classList.toggle(
    'hidden',
    active.size === 0
  );

  document.documentElement.toggleAttribute(
    'data-portal-loading',
    active.size > 0
  );
}

export const loadingManager = {
  begin(id, meta = {}) {
    const key = String(id || `loading_${Date.now()}`);

    active.set(key, {
      id: key,
      label: String(meta.label || ''),
      startedAt: performance.now(),
      createdAt: new Date().toISOString()
    });

    render();

    logger.info('Loading started', {
      id: key,
      label: meta.label || ''
    });

    return key;
  },

  end(id) {
    const key = String(id || '');
    const item = active.get(key);

    if (!item) {
      return;
    }

    active.delete(key);
    render();

    logger.info('Loading ended', {
      id: key,
      durationMs: Math.round(
        performance.now() - item.startedAt
      )
    });
  },

  clear() {
    active.clear();
    render();
  },

  isActive(id) {
    if (id) {
      return active.has(String(id));
    }

    return active.size > 0;
  },

  count() {
    return active.size;
  },

  snapshot() {
    return {
      count: active.size,
      active: [...active.values()].map((item) => ({
        id: item.id,
        label: item.label,
        createdAt: item.createdAt,
        durationMs: Math.round(
          performance.now() - item.startedAt
        )
      }))
    };
  }
};
