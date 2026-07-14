import { store } from './store.js';
import { logger } from './logger.js';
import { moduleLoader } from './module-loader.js';

const routes = new Map();
let currentModule = null;
let currentRoute = '';
let routerContext = null;
let started = false;

function normalizeRoute(value) {
  return String(value || '')
    .replace(/^#/, '')
    .trim() || 'dashboard';
}

async function renderRoute(name, { updateHistory = true, replace = false } = {}) {
  const routeName = normalizeRoute(name);
  const definition = routes.get(routeName) || routes.get('notFound');

  if (!definition) {
    throw new Error(`Route tidak ditemukan: ${routeName}`);
  }

  if (currentRoute === routeName && currentModule) return;

  if (currentModule?.unmount) {
    await currentModule.unmount();
  }

  const module = await moduleLoader.load(routeName, definition.loader);
  currentModule = module;
  currentRoute = routeName;

  store.setState({ route: routeName });

  await module.mount(routerContext.container, {
    ...routerContext,
    route: routeName,
    navigate: (target, options) => router.navigate(target, options)
  });

  if (updateHistory) {
    const nextHash = `#${routeName}`;
    if (replace) history.replaceState({ route: routeName }, '', nextHash);
    else history.pushState({ route: routeName }, '', nextHash);
  }

  logger.info('Route changed', { route: routeName });
  routerContext.onRouteChange?.(routeName);
}

export const router = {
  register(name, loader) {
    routes.set(name, { loader });
    return this;
  },

  async start(context) {
    if (started) return;
    started = true;
    routerContext = context;

    window.addEventListener('popstate', () => {
      renderRoute(location.hash, { updateHistory: false }).catch((error) => {
        logger.error('Back/forward navigation failed', {
          message: error.message
        });
      });
    });

    const initial = normalizeRoute(location.hash);
    await renderRoute(initial, { updateHistory: true, replace: true });
  },

  navigate(name, options = {}) {
    return renderRoute(name, {
      updateHistory: options.updateHistory !== false,
      replace: Boolean(options.replace)
    });
  },

  prefetch(name) {
    const definition = routes.get(name);
    if (definition) moduleLoader.prefetch(name, definition.loader);
  },

  getCurrentRoute() {
    return currentRoute || store.getState().route;
  },

  async destroy() {
    if (currentModule?.unmount) await currentModule.unmount();
    currentModule = null;
    currentRoute = '';
    routerContext = null;
    started = false;
  }
};
