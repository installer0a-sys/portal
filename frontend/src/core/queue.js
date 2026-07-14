import { loadingManager } from './loading.js';
import { toast } from './toast.js';
import { logger } from './logger.js';

const running = new Map();
const history = [];
const MAX_HISTORY = 100;

function addHistory(item) {
  history.push({
    timestamp: new Date().toISOString(),
    ...item
  });

  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function normalizeOptions(options) {
  return {
    id: String(options.id || ''),
    label: String(
      options.label ||
      options.id ||
      'Operasi'
    ),
    mode: options.mode || 'drop',
    showLoading:
      options.showLoading !== false,
    successMessage:
      options.successMessage ?? '',
    errorMessage:
      options.errorMessage ?? '',
    task: options.task
  };
}

export const queueManager = {
  async run(options = {}) {
    const config = normalizeOptions(options);

    if (!config.id) {
      throw new Error(
        'Queue operation id wajib tersedia.'
      );
    }

    if (typeof config.task !== 'function') {
      throw new Error(
        `Task queue ${config.id} tidak valid.`
      );
    }

    if (running.has(config.id)) {
      const existing = running.get(config.id);

      if (config.mode === 'join') {
        logger.info('Queue joined existing task', {
          id: config.id
        });

        return existing.promise;
      }

      if (config.mode === 'drop') {
        logger.info('Queue duplicate ignored', {
          id: config.id
        });

        return existing.promise;
      }

      throw new Error(
        `Mode queue tidak dikenal: ${config.mode}`
      );
    }

    const startedAt = performance.now();

    const record = {
      id: config.id,
      label: config.label,
      status: 'running',
      createdAt: new Date().toISOString(),
      startedAt
    };

    const loadingId =
      config.showLoading
        ? loadingManager.begin(
            `queue:${config.id}`,
            { label: config.label }
          )
        : null;

    const promise = Promise.resolve()
      .then(config.task)
      .then((result) => {
        record.status = 'completed';
        record.durationMs = Math.round(
          performance.now() - startedAt
        );

        addHistory({
          id: config.id,
          label: config.label,
          status: 'completed',
          durationMs: record.durationMs
        });

        logger.info('Queue task completed', {
          id: config.id,
          durationMs: record.durationMs
        });

        if (config.successMessage) {
          toast.success(
            config.successMessage,
            {
              key: `queue-success:${config.id}`
            }
          );
        }

        return result;
      })
      .catch((error) => {
        record.status = 'failed';
        record.durationMs = Math.round(
          performance.now() - startedAt
        );
        record.error = error.message;

        addHistory({
          id: config.id,
          label: config.label,
          status: 'failed',
          durationMs: record.durationMs,
          error: error.message
        });

        logger.error('Queue task failed', {
          id: config.id,
          message: error.message
        });

        toast.error(
          config.errorMessage ||
          error.message ||
          `${config.label} gagal.`,
          {
            key: `queue-error:${config.id}`
          }
        );

        throw error;
      })
      .finally(() => {
        if (loadingId) {
          loadingManager.end(loadingId);
        }

        running.delete(config.id);
      });

    record.promise = promise;
    running.set(config.id, record);

    addHistory({
      id: config.id,
      label: config.label,
      status: 'started'
    });

    logger.info('Queue task started', {
      id: config.id,
      label: config.label
    });

    return promise;
  },

  isRunning(id) {
    return running.has(String(id || ''));
  },

  get(id) {
    const item = running.get(String(id || ''));

    if (!item) {
      return null;
    }

    return {
      id: item.id,
      label: item.label,
      status: item.status,
      createdAt: item.createdAt,
      durationMs: Math.round(
        performance.now() - item.startedAt
      )
    };
  },

  clearHistory() {
    history.length = 0;
  },

  snapshot() {
    return {
      running: [...running.values()].map(
        (item) => ({
          id: item.id,
          label: item.label,
          status: item.status,
          createdAt: item.createdAt,
          durationMs: Math.round(
            performance.now() - item.startedAt
          )
        })
      ),
      history: [...history]
    };
  }
};
