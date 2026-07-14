import { eventBus } from './event-bus.js';
import { logger } from './logger.js';
import { toast } from './toast.js';
import { cacheEngine } from './cache.js';

let installed = false;
const unsubscribers = [];

function register(
  eventName,
  handler,
  options = {}
) {
  const unsubscribe =
    eventBus.on(
      eventName,
      handler,
      options
    );

  unsubscribers.push(
    unsubscribe
  );
}

export function installEventBridge() {
  if (installed) {
    return;
  }

  installed = true;

  register(
    'portal.notification.success',
    (payload = {}) => {
      toast.success(
        payload.message ||
        'Operasi berhasil.',
        {
          key:
            payload.key ||
            `event-success:${payload.message || 'success'}`
        }
      );
    },
    {
      source:
        'event-bridge.toast-success',
      priority: 100
    }
  );

  register(
    'portal.notification.error',
    (payload = {}) => {
      toast.error(
        payload.message ||
        'Operasi gagal.',
        {
          key:
            payload.key ||
            `event-error:${payload.message || 'error'}`
        }
      );
    },
    {
      source:
        'event-bridge.toast-error',
      priority: 100
    }
  );

  register(
    'portal.notification.warning',
    (payload = {}) => {
      toast.warning(
        payload.message ||
        'Perhatian diperlukan.',
        {
          key:
            payload.key ||
            `event-warning:${payload.message || 'warning'}`
        }
      );
    },
    {
      source:
        'event-bridge.toast-warning',
      priority: 100
    }
  );

  register(
    'portal.cache.invalidate',
    (payload = {}) => {
      return cacheEngine.invalidate(
        payload
      );
    },
    {
      source:
        'event-bridge.cache',
      priority: 50
    }
  );

  register(
    '*',
    (_payload, context) => {
      logger.info(
        'Event observed',
        {
          eventName:
            context.name,
          eventId:
            context.id,
          source:
            context.source
        }
      );
    },
    {
      source:
        'event-bridge.logger',
      priority: -100
    }
  );

  logger.info(
    'Portal Event Bridge installed'
  );
}

export function uninstallEventBridge() {
  while (unsubscribers.length) {
    const unsubscribe =
      unsubscribers.pop();

    try {
      unsubscribe?.();
    } catch {
      // Ignore cleanup errors.
    }
  }

  installed = false;

  logger.info(
    'Portal Event Bridge uninstalled'
  );
}
