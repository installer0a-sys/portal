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

const startedAt =
  performance.now();

export const diagnostics = {
  snapshot() {
    const state =
      store.getState();

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
        state.appVersion,
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
      registry:
        appRegistry.snapshot(),
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
