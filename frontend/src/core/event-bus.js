import { logger } from './logger.js';

const listeners = new Map();
const history = [];
const MAX_HISTORY = 200;

function normalizeEventName(value) {
  return String(value || '').trim();
}

function addHistory(entry) {
  history.push({
    timestamp: new Date().toISOString(),
    ...entry
  });

  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function getListeners(eventName) {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }

  return listeners.get(eventName);
}

function createListenerRecord(handler, options = {}) {
  return {
    handler,
    once: options.once === true,
    priority: Number(options.priority || 0),
    source: String(options.source || 'anonymous'),
    createdAt: new Date().toISOString()
  };
}

function sortRecords(records) {
  return [...records].sort(
    (a, b) => b.priority - a.priority
  );
}

async function executeHandler(
  eventName,
  record,
  payload,
  context
) {
  try {
    return await record.handler(
      payload,
      context
    );
  } catch (error) {
    logger.error('Event handler failed', {
      eventName,
      source: record.source,
      message: error.message
    });

    addHistory({
      type: 'handler-error',
      eventName,
      source: record.source,
      error: error.message
    });

    throw error;
  }
}

export const eventBus = {
  on(eventName, handler, options = {}) {
    const name = normalizeEventName(eventName);

    if (!name) {
      throw new Error('Nama event wajib tersedia.');
    }

    if (typeof handler !== 'function') {
      throw new Error(
        `Handler event ${name} harus berupa fungsi.`
      );
    }

    const record =
      createListenerRecord(
        handler,
        options
      );

    const records =
      getListeners(name);

    records.add(record);

    logger.info('Event listener registered', {
      eventName: name,
      source: record.source,
      once: record.once,
      priority: record.priority
    });

    return () => {
      records.delete(record);

      if (records.size === 0) {
        listeners.delete(name);
      }

      logger.info('Event listener removed', {
        eventName: name,
        source: record.source
      });
    };
  },

  once(eventName, handler, options = {}) {
    return this.on(
      eventName,
      handler,
      {
        ...options,
        once: true
      }
    );
  },

  off(eventName, handler) {
    const name = normalizeEventName(eventName);
    const records = listeners.get(name);

    if (!records) {
      return 0;
    }

    let removed = 0;

    for (const record of [...records]) {
      if (!handler || record.handler === handler) {
        records.delete(record);
        removed += 1;
      }
    }

    if (records.size === 0) {
      listeners.delete(name);
    }

    return removed;
  },

  async emit(eventName, payload = {}, options = {}) {
    const name = normalizeEventName(eventName);

    if (!name) {
      throw new Error('Nama event wajib tersedia.');
    }

    const eventId =
      options.eventId ||
      `evt_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;

    const startedAt =
      performance.now();

    const records =
      sortRecords(
        listeners.get(name) || []
      );

    const wildcardRecords =
      sortRecords(
        listeners.get('*') || []
      );

    const allRecords = [
      ...records,
      ...wildcardRecords
    ];

    const context = {
      id: eventId,
      name,
      emittedAt:
        new Date().toISOString(),
      source:
        String(options.source || 'unknown'),
      metadata:
        options.metadata || {}
    };

    addHistory({
      type: 'emit',
      eventId,
      eventName: name,
      source: context.source,
      listenerCount:
        allRecords.length
    });

    logger.info('Event emitted', {
      eventId,
      eventName: name,
      source: context.source,
      listenerCount:
        allRecords.length
    });

    const results = [];
    const errors = [];

    for (const record of allRecords) {
      try {
        const result =
          await executeHandler(
            name,
            record,
            payload,
            context
          );

        results.push({
          source: record.source,
          result
        });
      } catch (error) {
        errors.push({
          source: record.source,
          error: error.message
        });

        if (options.stopOnError === true) {
          break;
        }
      }

      if (record.once) {
        const targetName =
          wildcardRecords.includes(record)
            ? '*'
            : name;

        listeners
          .get(targetName)
          ?.delete(record);
      }
    }

    const durationMs = Math.round(
      performance.now() - startedAt
    );

    addHistory({
      type: 'completed',
      eventId,
      eventName: name,
      durationMs,
      resultCount:
        results.length,
      errorCount:
        errors.length
    });

    return {
      id: eventId,
      name,
      durationMs,
      listenerCount:
        allRecords.length,
      results,
      errors
    };
  },

  emitSync(eventName, payload = {}, options = {}) {
    const name = normalizeEventName(eventName);

    if (!name) {
      throw new Error('Nama event wajib tersedia.');
    }

    const eventId =
      options.eventId ||
      `evt_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;

    const records = [
      ...sortRecords(
        listeners.get(name) || []
      ),
      ...sortRecords(
        listeners.get('*') || []
      )
    ];

    const context = {
      id: eventId,
      name,
      emittedAt:
        new Date().toISOString(),
      source:
        String(options.source || 'unknown'),
      metadata:
        options.metadata || {}
    };

    const results = [];

    for (const record of records) {
      try {
        results.push({
          source: record.source,
          result:
            record.handler(
              payload,
              context
            )
        });
      } catch (error) {
        logger.error(
          'Synchronous event handler failed',
          {
            eventName: name,
            source: record.source,
            message: error.message
          }
        );

        if (options.stopOnError === true) {
          throw error;
        }
      }

      if (record.once) {
        const targetName =
          listeners
            .get('*')
            ?.has(record)
            ? '*'
            : name;

        listeners
          .get(targetName)
          ?.delete(record);
      }
    }

    addHistory({
      type: 'emit-sync',
      eventId,
      eventName: name,
      source: context.source,
      listenerCount:
        records.length
    });

    return {
      id: eventId,
      name,
      listenerCount:
        records.length,
      results
    };
  },

  listenerCount(eventName = '') {
    const name = normalizeEventName(eventName);

    if (name) {
      return listeners.get(name)?.size || 0;
    }

    return [...listeners.values()]
      .reduce(
        (total, records) =>
          total + records.size,
        0
      );
  },

  clear(eventName = '') {
    const name = normalizeEventName(eventName);

    if (name) {
      listeners.delete(name);
      return;
    }

    listeners.clear();
  },

  clearHistory() {
    history.length = 0;
  },

  snapshot() {
    return {
      totalListeners:
        this.listenerCount(),
      events:
        [...listeners.entries()]
          .map(([eventName, records]) => ({
            eventName,
            listenerCount:
              records.size,
            listeners:
              [...records].map(
                (record) => ({
                  source:
                    record.source,
                  once:
                    record.once,
                  priority:
                    record.priority,
                  createdAt:
                    record.createdAt
                })
              )
          }))
          .sort(
            (a, b) =>
              a.eventName.localeCompare(
                b.eventName
              )
          ),
      history: [...history]
    };
  }
};
