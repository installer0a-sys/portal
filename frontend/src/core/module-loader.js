import { logger } from './logger.js';

const modulePromises = new Map();
const moduleStats = new Map();

export const moduleLoader = {
  load(name, loader) {
    if (!name || typeof loader !== 'function') {
      throw new Error('Module name dan loader wajib tersedia.');
    }

    if (!modulePromises.has(name)) {
      const startedAt = performance.now();

      const promise = Promise.resolve()
        .then(loader)
        .then((module) => {
          if (!module || typeof module.mount !== 'function') {
            throw new Error(
              `Module ${name} tidak memiliki fungsi mount().`
            );
          }

          const durationMs = Math.round(
            performance.now() - startedAt
          );

          moduleStats.set(name, {
            name,
            loaded: true,
            durationMs,
            loadedAt: new Date().toISOString()
          });

          logger.info('Module loaded', {
            name,
            durationMs
          });

          return module;
        })
        .catch((error) => {
          modulePromises.delete(name);

          moduleStats.set(name, {
            name,
            loaded: false,
            error: error.message,
            failedAt: new Date().toISOString()
          });

          logger.error('Module load failed', {
            name,
            message: error.message
          });

          throw error;
        });

      modulePromises.set(name, promise);
    }

    return modulePromises.get(name);
  },

  preload(name, loader) {
    return this.load(name, loader).catch(() => null);
  },

  has(name) {
    return modulePromises.has(name);
  },

  clear(name) {
    if (name) {
      modulePromises.delete(name);
      moduleStats.delete(name);
      return;
    }

    modulePromises.clear();
    moduleStats.clear();
  },

  snapshot() {
    return {
      cachedModules: [...modulePromises.keys()],
      modules: [...moduleStats.values()]
    };
  }
};
