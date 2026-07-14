import { store } from './store.js';
import { logger } from './logger.js';

const routes = new Map();
let activeRoute = null;
let activeModule = null;

export const router = {
  register(name, loader) {
    routes.set(name, loader);
  },

  async navigate(name, context = {}) {
    const loader = routes.get(name);

    if (!loader) {
      throw new Error(`Route tidak ditemukan: ${name}`);
    }

    if (
      activeRoute === name &&
      activeModule &&
      typeof activeModule.refresh === 'function'
    ) {
      await activeModule.refresh(context);
      return;
    }

    if (
      activeModule &&
      typeof activeModule.unmount === 'function'
    ) {
      await activeModule.unmount();
    }

    const loaded = await loader();

    if (!loaded || typeof loaded.mount !== 'function') {
      throw new Error(`Module ${name} tidak memiliki mount().`);
    }

    activeRoute = name;
    activeModule = loaded;

    store.setState({ route: name });

    await loaded.mount(context.container, {
      ...context,
      navigate: (target, options = {}) =>
        this.navigate(target, {
          ...context,
          ...options
        })
    });

    const mode = context.historyMode || 'push';
    const hash = `#${name}`;

    if (mode === 'replace') {
      history.replaceState({}, '', hash);
    } else if (mode === 'push' && location.hash !== hash) {
      history.pushState({}, '', hash);
    }

    logger.info('Route changed', { route: name });
  },

  getCurrentRoute() {
    return activeRoute;
  }
};
