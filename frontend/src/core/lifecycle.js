import { logger } from './logger.js';
import { moduleLoader } from './module-loader.js';

const CLEANUP_TIMEOUT_MS = 5000;

let activeRecord = null;
const history = [];
const MAX_HISTORY = 50;

function pushHistory(entry) {
  history.push({
    timestamp: new Date().toISOString(),
    ...entry
  });

  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function createScope(moduleName) {
  const controller = new AbortController();
  const cleanupCallbacks = new Set();
  const timeoutIds = new Set();
  const intervalIds = new Set();

  return {
    moduleName,
    signal: controller.signal,

    addCleanup(callback) {
      if (typeof callback === 'function') {
        cleanupCallbacks.add(callback);
      }

      return () => {
        cleanupCallbacks.delete(callback);
      };
    },

    setTimeout(callback, delay, ...args) {
      const id = window.setTimeout(() => {
        timeoutIds.delete(id);
        callback(...args);
      }, delay);

      timeoutIds.add(id);
      return id;
    },

    clearTimeout(id) {
      window.clearTimeout(id);
      timeoutIds.delete(id);
    },

    setInterval(callback, delay, ...args) {
      const id = window.setInterval(
        callback,
        delay,
        ...args
      );

      intervalIds.add(id);
      return id;
    },

    clearInterval(id) {
      window.clearInterval(id);
      intervalIds.delete(id);
    },

    listen(target, eventName, handler, options = {}) {
      if (!target?.addEventListener) {
        throw new Error(
          `Target listener tidak valid pada module ${moduleName}.`
        );
      }

      target.addEventListener(
        eventName,
        handler,
        {
          ...options,
          signal: controller.signal
        }
      );
    },

    abort(reason = 'module-deactivated') {
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
    },

    async cleanup() {
      this.abort();

      timeoutIds.forEach((id) => {
        window.clearTimeout(id);
      });

      intervalIds.forEach((id) => {
        window.clearInterval(id);
      });

      timeoutIds.clear();
      intervalIds.clear();

      const callbacks = [...cleanupCallbacks];
      cleanupCallbacks.clear();

      for (const callback of callbacks.reverse()) {
        try {
          await callback();
        } catch (error) {
          logger.warn('Lifecycle cleanup callback failed', {
            moduleName,
            message: error.message
          });
        }
      }
    },

    snapshot() {
      return {
        moduleName,
        aborted: controller.signal.aborted,
        cleanupCallbacks: cleanupCallbacks.size,
        timeouts: timeoutIds.size,
        intervals: intervalIds.size
      };
    }
  };
}

async function withTimeout(
  promise,
  timeoutMs,
  label
) {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          reject(
            new Error(
              `${label} melewati batas ${timeoutMs} ms.`
            )
          );
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      window.clearTimeout(timer);
    }
  }
}

export const lifecycleManager = {
  async activate({
    name,
    loader,
    container,
    context = {}
  }) {
    if (!name) {
      throw new Error('Nama module wajib tersedia.');
    }

    if (!container) {
      throw new Error(
        `Container module ${name} tidak ditemukan.`
      );
    }

    if (
      activeRecord?.name === name &&
      activeRecord.module &&
      typeof activeRecord.module.refresh === 'function'
    ) {
      activeRecord.status = 'refreshing';
      activeRecord.lastActionAt =
        new Date().toISOString();

      const startedAt = performance.now();

      try {
        await activeRecord.module.refresh({
          ...context,
          lifecycle: activeRecord.scope
        });

        activeRecord.status = 'active';
        activeRecord.refreshCount += 1;

        pushHistory({
          type: 'refresh',
          name,
          durationMs: Math.round(
            performance.now() - startedAt
          )
        });

        logger.info('Module refreshed', {
          name
        });

        return activeRecord.module;
      } catch (error) {
        activeRecord.status = 'error';
        activeRecord.lastError = error.message;

        logger.error('Module refresh failed', {
          name,
          message: error.message
        });

        throw error;
      }
    }

    await this.deactivate('route-change');

    const module = await moduleLoader.load(
      name,
      loader
    );

    const scope = createScope(name);

    const record = {
      name,
      module,
      container,
      scope,
      status: 'mounting',
      mountedAt: null,
      lastActionAt: new Date().toISOString(),
      mountCount: 0,
      refreshCount: 0,
      lastError: null
    };

    activeRecord = record;

    const startedAt = performance.now();

    try {
      await module.mount(
        container,
        {
          ...context,
          lifecycle: scope
        }
      );

      record.status = 'active';
      record.mountedAt =
        new Date().toISOString();
      record.mountCount += 1;

      const durationMs = Math.round(
        performance.now() - startedAt
      );

      pushHistory({
        type: 'mount',
        name,
        durationMs
      });

      logger.info('Module mounted', {
        name,
        durationMs
      });

      return module;
    } catch (error) {
      record.status = 'error';
      record.lastError = error.message;

      await scope.cleanup();

      if (activeRecord === record) {
        activeRecord = null;
      }

      pushHistory({
        type: 'mount-error',
        name,
        message: error.message
      });

      logger.error('Module mount failed', {
        name,
        message: error.message
      });

      throw error;
    }
  },

  async deactivate(reason = 'manual') {
    const record = activeRecord;

    if (!record) {
      return;
    }

    activeRecord = null;
    record.status = 'unmounting';
    record.lastActionAt =
      new Date().toISOString();

    const startedAt = performance.now();

    try {
      record.scope.abort(reason);

      if (
        record.module &&
        typeof record.module.pause === 'function'
      ) {
        await withTimeout(
          Promise.resolve(
            record.module.pause({
              reason,
              lifecycle: record.scope
            })
          ),
          CLEANUP_TIMEOUT_MS,
          `pause ${record.name}`
        );
      }

      if (
        record.module &&
        typeof record.module.unmount === 'function'
      ) {
        await withTimeout(
          Promise.resolve(
            record.module.unmount({
              reason,
              lifecycle: record.scope
            })
          ),
          CLEANUP_TIMEOUT_MS,
          `unmount ${record.name}`
        );
      }
    } catch (error) {
      record.lastError = error.message;

      logger.warn('Module deactivate warning', {
        name: record.name,
        message: error.message
      });
    } finally {
      await record.scope.cleanup();

      record.status = 'inactive';

      const durationMs = Math.round(
        performance.now() - startedAt
      );

      pushHistory({
        type: 'unmount',
        name: record.name,
        reason,
        durationMs
      });

      logger.info('Module unmounted', {
        name: record.name,
        reason,
        durationMs
      });
    }
  },

  getActiveName() {
    return activeRecord?.name || null;
  },

  snapshot() {
    return {
      active: activeRecord
        ? {
            name: activeRecord.name,
            status: activeRecord.status,
            mountedAt: activeRecord.mountedAt,
            lastActionAt:
              activeRecord.lastActionAt,
            mountCount:
              activeRecord.mountCount,
            refreshCount:
              activeRecord.refreshCount,
            lastError:
              activeRecord.lastError,
            scope:
              activeRecord.scope.snapshot()
          }
        : null,
      history: [...history],
      loader: moduleLoader.snapshot()
    };
  }
};
