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
      { scope: '/portal/' }
    );

    logger.info('Service worker registered', {
      scope: registration.scope
    });

    return {
      supported: true,
      registered: true,
      registration
    };
  } catch (error) {
    logger.error('Service worker registration failed', {
      message: error.message
    });

    return {
      supported: true,
      registered: false,
      registration: null,
      error: error.message
    };
  }
}
