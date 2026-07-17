import { store } from './store.js';
import { logger } from './logger.js';
import {
  lifecycleManager
} from './lifecycle.js';

const routes = new Map();

export const router = {
  register(name, loader) {
    if (!name || typeof loader !== 'function') {
      throw new Error(
        'Route name dan loader wajib tersedia.'
      );
    }

    routes.set(name, loader);
  },

  has(name) {
    return routes.has(name);
  },

  async navigate(
    name,
    context = {}
  ) {
    const loader = routes.get(name);

    if (!loader) {
      throw new Error(
        `Route tidak ditemukan: ${name}`
      );
    }

    await lifecycleManager.activate({
      name,
      loader,
      container: context.container,
      context: {
        ...context,
        navigate:
          typeof context.navigate === 'function'
            ? context.navigate
            : (
                target,
                options = {}
              ) =>
                this.navigate(target, {
                  ...context,
                  ...options
                })
      }
    });

    store.setState({
      route: name
    });

    const historyMode =
      context.historyMode || 'push';

    const nextHash = `#${name}`;

    if (historyMode === 'replace') {
      window.history.replaceState(
        {},
        '',
        nextHash
      );
    } else if (
      historyMode === 'push' &&
      window.location.hash !== nextHash
    ) {
      window.history.pushState(
        {},
        '',
        nextHash
      );
    }

    logger.info('Route changed', {
      route: name
    });
  },

  async stop() {
    await lifecycleManager.deactivate(
      'router-stop'
    );
  },

  getCurrentRoute() {
    return store.getState().route;
  }
};
