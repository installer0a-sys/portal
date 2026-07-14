import { store } from './store.js';
import { logger } from './logger.js';
import {
  lifecycleManager
} from './lifecycle.js';
import {
  queueManager
} from './queue.js';
import {
  loadingManager
} from './loading.js';
import { toast } from './toast.js';
import {
  appRegistry
} from '../apps/registry.js';
import {
  Portal
} from '../sdk/portal-sdk.js';
import {
  permissionEngine
} from './permission.js';
import {
  cacheEngine
} from './cache.js';
import {
  updateManager
} from './update-manager.js';
import {
  VERSION_INFO
} from './version.js';

const startedAt =
  performance.now();

export const diagnostics = {
  snapshot() {
    const state =
      store.getState();

    const session = {
      user:
        state.user || null,
      access:
        state.permissions || {}
    };

    return {
      timestamp:
        new Date().toISOString(),
      uptimeMs:
        Math.round(
          performance.now() -
          startedAt
        ),
      route:
        state.route,
      networkOnline:
        navigator.onLine,
      pendingRequests:
        state.pendingRequests,
      lastError:
        state.lastError,
      frontendVersion:
        VERSION_INFO.version,
      frontendBuild:
        VERSION_INFO.build,
      serviceWorkerSupported:
        'serviceWorker' in navigator,
      userAgent:
        navigator.userAgent,
      viewport: {
        width:
          window.innerWidth,
        height:
          window.innerHeight
      },
      memory:
        performance.memory
          ? {
              usedJsHeapSize:
                performance.memory.usedJSHeapSize,
              totalJsHeapSize:
                performance.memory.totalJSHeapSize,
              jsHeapSizeLimit:
                performance.memory.jsHeapSizeLimit
            }
          : null,
      sdk:
        Portal.snapshot(),
      update:
        updateManager.snapshot(),
      registry:
        appRegistry.snapshot(),
      permission:
        permissionEngine.snapshot(
          session
        ),
      cache:
        cacheEngine.snapshot(),
      lifecycle:
        lifecycleManager.snapshot(),
      queue:
        queueManager.snapshot(),
      loading:
        loadingManager.snapshot(),
      toast:
        toast.snapshot(),
      logs:
        logger.getLogs()
    };
  }
};
