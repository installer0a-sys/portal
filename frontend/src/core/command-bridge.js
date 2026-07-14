import {
  commandBus
} from './command-bus.js';
import {
  eventBus
} from './event-bus.js';
import {
  updateManager
} from './update-manager.js';
import {
  cacheEngine
} from './cache.js';
import {
  lifecycleManager
} from './lifecycle.js';
import {
  router
} from './router.js';
import {
  logout
} from '../auth/auth.js';
import {
  logger
} from './logger.js';

let installed = false;
const unregisters = [];

function register(
  name,
  handler,
  options = {}
) {
  unregisters.push(
    commandBus.register(
      name,
      handler,
      options
    )
  );
}

export function installCommandBridge() {
  if (installed) {
    return;
  }

  installed = true;

  register(
    'portal.update.check',
    (payload = {}) =>
      updateManager.check({
        notify:
          payload.notify !== false
      }),
    {
      source:
        'command-bridge.update'
    }
  );

  register(
    'portal.update.apply',
    (payload = {}) =>
      updateManager.apply({
        reload:
          payload.reload !== false
      }),
    {
      source:
        'command-bridge.update'
    }
  );

  register(
    'portal.cache.invalidate',
    (payload = {}) =>
      cacheEngine.invalidate(
        payload
      ),
    {
      source:
        'command-bridge.cache'
    }
  );

  register(
    'portal.lifecycle.deactivate',
    (payload = {}) =>
      lifecycleManager.deactivate(
        payload.reason ||
        'command'
      ),
    {
      source:
        'command-bridge.lifecycle'
    }
  );

  register(
    'portal.route.navigate',
    (payload = {}) => {
      if (!payload.route) {
        throw new Error(
          'Route command wajib tersedia.'
        );
      }

      return router.navigate(
        payload.route,
        payload.context || {}
      );
    },
    {
      source:
        'command-bridge.router'
    }
  );

  register(
    'portal.logout',
    async (payload = {}) => {
      await lifecycleManager.deactivate(
        'logout-command'
      );

      await logout();

      await eventBus.emit(
        'portal.auth.logged-out',
        {
          reason:
            payload.reason ||
            'manual'
        },
        {
          source:
            'command-bridge.logout'
        }
      );

      return {
        loggedOut: true
      };
    },
    {
      source:
        'command-bridge.auth'
    }
  );

  register(
    'portal.app.refresh',
    async (payload = {}) => {
      const activeName =
        lifecycleManager
          .getActiveName();

      if (!activeName) {
        return {
          refreshed: false,
          reason:
            'no-active-module'
        };
      }

      await eventBus.emit(
        'portal.app.refresh-requested',
        {
          appId:
            payload.appId ||
            activeName
        },
        {
          source:
            'command-bridge.refresh'
        }
      );

      return {
        refreshed: true,
        appId:
          payload.appId ||
          activeName
      };
    },
    {
      source:
        'command-bridge.app'
    }
  );

  logger.info(
    'Portal Command Bridge installed'
  );
}

export function uninstallCommandBridge() {
  while (unregisters.length) {
    const unregister =
      unregisters.pop();

    try {
      unregister?.();
    } catch {
      // Ignore cleanup errors.
    }
  }

  installed = false;

  logger.info(
    'Portal Command Bridge uninstalled'
  );
}
