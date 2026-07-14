import { logger } from './logger.js';

const STORAGE_PREFIX = 'portal.cache.v1';
const INDEX_KEY = `${STORAGE_PREFIX}:index`;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_INDEX_ITEMS = 300;

let runtimeContext = {
  userId: 'anonymous',
  permissionSignature: 'anonymous',
  sessionVersion: '0'
};

const memory = new Map();

function normalize(value, fallback = '') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadIndex() {
  return safeParse(
    localStorage.getItem(INDEX_KEY),
    []
  ) || [];
}

function saveIndex(items) {
  try {
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify(items.slice(-MAX_INDEX_ITEMS))
    );
  } catch (error) {
    logger.warn('Cache index save failed', {
      message: error.message
    });
  }
}

function updateIndex(record) {
  const items = loadIndex().filter(
    (item) => item.storageKey !== record.storageKey
  );

  items.push({
    storageKey: record.storageKey,
    userId: record.userId,
    appId: record.appId,
    namespace: record.namespace,
    dataVersion: record.dataVersion,
    permissionSignature:
      record.permissionSignature,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    lastAccessedAt: record.lastAccessedAt
  });

  saveIndex(items);
}

function removeFromIndex(storageKey) {
  const items = loadIndex().filter(
    (item) => item.storageKey !== storageKey
  );

  saveIndex(items);
}

function normalizeOptions(options = {}) {
  return {
    appId:
      normalize(options.appId, 'portal'),
    namespace:
      normalize(options.namespace, 'default'),
    key:
      normalize(options.key),
    dataVersion:
      normalize(options.dataVersion, '1'),
    ttlMs:
      Number.isFinite(Number(options.ttlMs))
        ? Math.max(0, Number(options.ttlMs))
        : DEFAULT_TTL_MS,
    storage:
      options.storage === 'memory'
        ? 'memory'
        : 'local'
  };
}

function createScope(options) {
  return {
    userId:
      normalize(
        options.userId,
        runtimeContext.userId
      ),
    permissionSignature:
      normalize(
        options.permissionSignature,
        runtimeContext.permissionSignature
      ),
    sessionVersion:
      normalize(
        options.sessionVersion,
        runtimeContext.sessionVersion
      )
  };
}

function createStorageKey(options, scope) {
  if (!options.key) {
    throw new Error(
      'Cache key wajib tersedia.'
    );
  }

  return [
    STORAGE_PREFIX,
    encodeURIComponent(scope.userId),
    encodeURIComponent(scope.permissionSignature),
    encodeURIComponent(scope.sessionVersion),
    encodeURIComponent(options.appId),
    encodeURIComponent(options.namespace),
    encodeURIComponent(options.dataVersion),
    encodeURIComponent(options.key)
  ].join(':');
}

function readRaw(storageKey, storage) {
  if (storage === 'memory') {
    return memory.get(storageKey) || null;
  }

  const value =
    localStorage.getItem(storageKey);

  return value
    ? safeParse(value)
    : null;
}

function writeRaw(storageKey, value, storage) {
  if (storage === 'memory') {
    memory.set(storageKey, value);
    return;
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify(value)
  );
}

function deleteRaw(storageKey, storage) {
  memory.delete(storageKey);

  if (storage !== 'memory') {
    localStorage.removeItem(storageKey);
  }

  removeFromIndex(storageKey);
}

function isExpired(record, now = Date.now()) {
  return Boolean(
    record?.expiresAt &&
    now >= record.expiresAt
  );
}

export const cacheEngine = {
  setContext(context = {}) {
    runtimeContext = {
      userId:
        normalize(
          context.userId,
          'anonymous'
        ),
      permissionSignature:
        normalize(
          context.permissionSignature,
          'anonymous'
        ),
      sessionVersion:
        normalize(
          context.sessionVersion,
          '0'
        )
    };

    logger.info('Cache context updated', {
      ...runtimeContext
    });

    return this.getContext();
  },

  clearContext() {
    runtimeContext = {
      userId: 'anonymous',
      permissionSignature: 'anonymous',
      sessionVersion: '0'
    };

    logger.info('Cache runtime context cleared');
  },

  getContext() {
    return {
      ...runtimeContext
    };
  },

  set(options = {}, value) {
    const config =
      normalizeOptions(options);

    const scope =
      createScope(options);

    const storageKey =
      createStorageKey(
        config,
        scope
      );

    const now = Date.now();

    const record = {
      storageKey,
      userId: scope.userId,
      permissionSignature:
        scope.permissionSignature,
      sessionVersion:
        scope.sessionVersion,
      appId:
        config.appId,
      namespace:
        config.namespace,
      key:
        config.key,
      dataVersion:
        config.dataVersion,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      expiresAt:
        config.ttlMs === 0
          ? 0
          : now + config.ttlMs,
      value
    };

    try {
      writeRaw(
        storageKey,
        record,
        config.storage
      );

      updateIndex(record);

      logger.info('Cache item stored', {
        appId:
          config.appId,
        namespace:
          config.namespace,
        key:
          config.key,
        storage:
          config.storage,
        ttlMs:
          config.ttlMs
      });

      return value;
    } catch (error) {
      logger.warn('Cache write failed', {
        appId:
          config.appId,
        key:
          config.key,
        message:
          error.message
      });

      return value;
    }
  },

  get(options = {}) {
    const config =
      normalizeOptions(options);

    const scope =
      createScope(options);

    const storageKey =
      createStorageKey(
        config,
        scope
      );

    const record =
      readRaw(
        storageKey,
        config.storage
      );

    if (!record) {
      return null;
    }

    if (isExpired(record)) {
      deleteRaw(
        storageKey,
        config.storage
      );

      logger.info('Cache item expired', {
        appId:
          config.appId,
        key:
          config.key
      });

      return null;
    }

    record.lastAccessedAt =
      Date.now();

    try {
      writeRaw(
        storageKey,
        record,
        config.storage
      );

      updateIndex(record);
    } catch {
      // Cache tetap dapat dibaca walaupun metadata gagal diperbarui.
    }

    return record.value;
  },

  has(options = {}) {
    return this.get(options) !== null;
  },

  remove(options = {}) {
    const config =
      normalizeOptions(options);

    const scope =
      createScope(options);

    const storageKey =
      createStorageKey(
        config,
        scope
      );

    deleteRaw(
      storageKey,
      config.storage
    );

    logger.info('Cache item removed', {
      appId:
        config.appId,
      namespace:
        config.namespace,
      key:
        config.key
    });
  },

  async remember(
    options = {},
    loader
  ) {
    if (typeof loader !== 'function') {
      throw new Error(
        'Cache loader wajib berupa fungsi.'
      );
    }

    const cached =
      this.get(options);

    if (cached !== null) {
      logger.info('Cache hit', {
        appId:
          options.appId || 'portal',
        namespace:
          options.namespace || 'default',
        key:
          options.key || ''
      });

      return {
        value: cached,
        source: 'cache'
      };
    }

    logger.info('Cache miss', {
      appId:
        options.appId || 'portal',
      namespace:
        options.namespace || 'default',
      key:
        options.key || ''
    });

    const value =
      await loader();

    this.set(
      options,
      value
    );

    return {
      value,
      source: 'loader'
    };
  },

  invalidate({
    appId = '',
    namespace = '',
    userId = '',
    permissionSignature = '',
    dataVersion = ''
  } = {}) {
    const filters = {
      appId:
        normalize(appId),
      namespace:
        normalize(namespace),
      userId:
        normalize(userId),
      permissionSignature:
        normalize(permissionSignature),
      dataVersion:
        normalize(dataVersion)
    };

    const index = loadIndex();
    let removed = 0;

    index.forEach((item) => {
      const matches =
        (!filters.appId ||
          item.appId === filters.appId) &&
        (!filters.namespace ||
          item.namespace === filters.namespace) &&
        (!filters.userId ||
          item.userId === filters.userId) &&
        (!filters.permissionSignature ||
          item.permissionSignature ===
            filters.permissionSignature) &&
        (!filters.dataVersion ||
          item.dataVersion === filters.dataVersion);

      if (!matches) {
        return;
      }

      localStorage.removeItem(
        item.storageKey
      );

      memory.delete(
        item.storageKey
      );

      removed += 1;
    });

    const next = index.filter((item) => {
      return localStorage.getItem(
        item.storageKey
      ) !== null;
    });

    saveIndex(next);

    logger.info('Cache invalidated', {
      ...filters,
      removed
    });

    return removed;
  },

  prune() {
    const now = Date.now();
    const index = loadIndex();
    let removed = 0;

    index.forEach((item) => {
      if (
        item.expiresAt &&
        now >= item.expiresAt
      ) {
        localStorage.removeItem(
          item.storageKey
        );

        memory.delete(
          item.storageKey
        );

        removed += 1;
      }
    });

    const next = index.filter((item) => {
      if (
        item.expiresAt &&
        now >= item.expiresAt
      ) {
        return false;
      }

      return localStorage.getItem(
        item.storageKey
      ) !== null;
    });

    saveIndex(next);

    logger.info('Cache pruned', {
      removed,
      remaining:
        next.length
    });

    return removed;
  },

  snapshot() {
    const now = Date.now();

    return {
      context:
        this.getContext(),
      memoryCount:
        memory.size,
      persistentCount:
        loadIndex().length,
      items:
        loadIndex().map(
          (item) => ({
            userId:
              item.userId,
            appId:
              item.appId,
            namespace:
              item.namespace,
            dataVersion:
              item.dataVersion,
            permissionSignature:
              item.permissionSignature,
            expiresAt:
              item.expiresAt,
            expired:
              Boolean(
                item.expiresAt &&
                now >= item.expiresAt
              )
          })
        )
    };
  }
};
