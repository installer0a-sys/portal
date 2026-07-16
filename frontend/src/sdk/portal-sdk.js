import { router } from '../core/router.js';
import {
  lifecycleManager
} from '../core/lifecycle.js';
import {
  moduleLoader
} from '../core/module-loader.js';
import {
  queueManager
} from '../core/queue.js';
import {
  loadingManager
} from '../core/loading.js';
import { toast } from '../core/toast.js';
import { logger } from '../core/logger.js';
import {
  appRegistry
} from '../apps/registry.js';
import {
  permissionEngine
} from '../core/permission.js';
import {
  cacheEngine
} from '../core/cache.js';
import {
  updateManager
} from '../core/update-manager.js';
import {
  eventBus
} from '../core/event-bus.js';
import {
  commandBus
} from '../core/command-bus.js';
import {
  VERSION_INFO
} from '../core/version.js';

const sdkState = {
  apps: new Map(),
  startedAt:
    new Date().toISOString()
};

function assertAppDefinition(
  definition
) {
  if (
    !definition ||
    typeof definition !== 'object'
  ) {
    throw new Error(
      'Definisi aplikasi tidak valid.'
    );
  }

  if (!definition.id) {
    throw new Error(
      'Aplikasi wajib memiliki id.'
    );
  }

  if (
    typeof definition.mount !==
    'function'
  ) {
    throw new Error(
      `Aplikasi ${definition.id} wajib memiliki mount().`
    );
  }
}

export function defineApp(
  definition
) {
  assertAppDefinition(
    definition
  );

  const app = {
    id:
      String(definition.id),
    mount:
      definition.mount,
    refresh:
      typeof definition.refresh ===
      'function'
        ? definition.refresh
        : async () => {},
    pause:
      typeof definition.pause ===
      'function'
        ? definition.pause
        : async () => {},
    resume:
      typeof definition.resume ===
      'function'
        ? definition.resume
        : async () => {},
    unmount:
      typeof definition.unmount ===
      'function'
        ? definition.unmount
        : async () => {}
  };

  sdkState.apps.set(
    app.id,
    {
      id:
        app.id,
      registeredAt:
        new Date().toISOString()
    }
  );

  logger.info(
    'SDK app defined',
    {
      appId:
        app.id
    }
  );

  return app;
}

export const Portal = {
  version:
    '0.4.4',
  build:
    VERSION_INFO.build,

  defineApp,

  registry:
    appRegistry,
  permission:
    permissionEngine,
  cache:
    cacheEngine,
  update:
    updateManager,
  events:
    eventBus,
  commands:
    commandBus,
  router,
  lifecycle:
    lifecycleManager,
  modules:
    moduleLoader,
  queue:
    queueManager,
  loading:
    loadingManager,
  toast,
  logger,

  snapshot() {
    return {
      version:
        this.version,
      build:
        this.build,
      startedAt:
        sdkState.startedAt,
      registeredApps:
        [
          ...sdkState.apps.values()
        ],
      manifestCount:
        appRegistry.list({
          enabledOnly:
            false
        }).length
    };
  }
};

if (
  typeof window !==
  'undefined'
) {
  window.Portal =
    Portal;
}
