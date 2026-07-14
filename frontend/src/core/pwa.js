import { logger } from './logger.js';

export async function registerPwa() {
  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      registered: false,
      registration: null
    };
  }

  try {
    const registration = await navigator.serviceWorker.register(
      '/portal/sw.js',
      {
        scope: '/portal/',
        updateViaCache: 'none'
      }
    );

    await registration.update();

    if (registration.waiting) {
      registration.waiting.postMessage({
        type: 'SKIP_WAITING'
      });
    }

    registration.addEventListener(
      'updatefound',
      () => {
        const worker =
          registration.installing;

        if (!worker) {
          return;
        }

        worker.addEventListener(
          'statechange',
          () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              worker.postMessage({
                type: 'SKIP_WAITING'
              });
            }
          }
        );
      }
    );

    let refreshing = false;

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        if (refreshing) {
          return;
        }

        refreshing = true;

        logger.info(
          'Service worker controller updated'
        );
      }
    );

    logger.info(
      'Service worker registered',
      {
        scope: registration.scope
      }
    );

    return {
      supported: true,
      registered: true,
      registration
    };
  } catch (error) {
    logger.error(
      'Service worker registration failed',
      {
        message: error.message
      }
    );

    return {
      supported: true,
      registered: false,
      registration: null,
      error: error.message
    };
  }
}

export async function clearPwaRuntimeCache() {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  const registration =
    await navigator.serviceWorker.getRegistration(
      '/portal/'
    );

  const worker =
    registration?.active ||
    registration?.waiting ||
    registration?.installing;

  worker?.postMessage({
    type: 'CLEAR_RUNTIME_CACHE'
  });

  return true;
}
