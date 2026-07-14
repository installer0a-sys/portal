import { logger } from './logger.js';

const handlers = new Map();
const history = [];
const MAX_HISTORY = 200;

function normalizeName(value) {
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

export const commandBus = {
  register(name, handler, options = {}) {
    const commandName = normalizeName(name);

    if (!commandName) {
      throw new Error(
        'Nama command wajib tersedia.'
      );
    }

    if (typeof handler !== 'function') {
      throw new Error(
        `Handler command ${commandName} harus berupa fungsi.`
      );
    }

    if (
      handlers.has(commandName) &&
      options.replace !== true
    ) {
      throw new Error(
        `Command sudah terdaftar: ${commandName}`
      );
    }

    handlers.set(commandName, {
      name: commandName,
      handler,
      source:
        String(options.source || 'anonymous'),
      createdAt:
        new Date().toISOString()
    });

    logger.info('Command registered', {
      commandName,
      source:
        options.source || 'anonymous'
    });

    return () => {
      this.unregister(commandName);
    };
  },

  unregister(name) {
    const commandName = normalizeName(name);
    const removed =
      handlers.delete(commandName);

    if (removed) {
      logger.info('Command unregistered', {
        commandName
      });
    }

    return removed;
  },

  has(name) {
    return handlers.has(
      normalizeName(name)
    );
  },

  async run(
    name,
    payload = {},
    options = {}
  ) {
    const commandName =
      normalizeName(name);

    const record =
      handlers.get(commandName);

    if (!record) {
      const error = new Error(
        `Command tidak ditemukan: ${commandName}`
      );

      error.code =
        'COMMAND_NOT_FOUND';

      addHistory({
        type: 'missing',
        commandName,
        source:
          options.source || 'unknown'
      });

      throw error;
    }

    const commandId =
      options.commandId ||
      `cmd_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;

    const startedAt =
      performance.now();

    const context = {
      id: commandId,
      name: commandName,
      source:
        String(options.source || 'unknown'),
      startedAt:
        new Date().toISOString(),
      metadata:
        options.metadata || {}
    };

    addHistory({
      type: 'started',
      commandId,
      commandName,
      source: context.source,
      handlerSource:
        record.source
    });

    logger.info('Command started', {
      commandId,
      commandName,
      source: context.source,
      handlerSource:
        record.source
    });

    try {
      const result =
        await record.handler(
          payload,
          context
        );

      const durationMs =
        Math.round(
          performance.now() -
          startedAt
        );

      addHistory({
        type: 'completed',
        commandId,
        commandName,
        durationMs
      });

      logger.info('Command completed', {
        commandId,
        commandName,
        durationMs
      });

      return {
        id: commandId,
        name: commandName,
        durationMs,
        result
      };
    } catch (error) {
      const durationMs =
        Math.round(
          performance.now() -
          startedAt
        );

      addHistory({
        type: 'failed',
        commandId,
        commandName,
        durationMs,
        error:
          error.message
      });

      logger.error('Command failed', {
        commandId,
        commandName,
        durationMs,
        message:
          error.message
      });

      throw error;
    }
  },

  list() {
    return [...handlers.values()]
      .map((item) => ({
        name:
          item.name,
        source:
          item.source,
        createdAt:
          item.createdAt
      }))
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );
  },

  clear() {
    handlers.clear();
  },

  clearHistory() {
    history.length = 0;
  },

  snapshot() {
    return {
      commandCount:
        handlers.size,
      commands:
        this.list(),
      history:
        [...history]
    };
  }
};
