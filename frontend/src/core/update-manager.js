import {
  VERSION_INFO,
  isNewerVersion
} from './version.js';
import { logger } from './logger.js';
import { toast } from './toast.js';

const VERSION_URL =
  '/portal/version.json';

let state = {
  status: 'idle',
  current: VERSION_INFO,
  remote: null,
  updateAvailable: false,
  checkedAt: null,
  error: null
};

function setState(patch) {
  state = {
    ...state,
    ...patch
  };

  return {
    ...state
  };
}

async function getRegistration() {
  if (
    !('serviceWorker' in navigator)
  ) {
    return null;
  }

  return navigator.serviceWorker.getRegistration(
    '/portal/'
  );
}

export const updateManager = {
  async check({
    notify = true
  } = {}) {
    setState({
      status: 'checking',
      error: null
    });

    try {
      const response = await fetch(
        `${VERSION_URL}?t=${Date.now()}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Version check HTTP ${response.status}`
        );
      }

      const remote =
        await response.json();

      const updateAvailable =
        isNewerVersion(
          remote?.version,
          VERSION_INFO.version
        ) ||
        (
          String(remote?.version || '') ===
          VERSION_INFO.version &&
          String(remote?.build || '') !==
          VERSION_INFO.build
        );

      setState({
        status:
          updateAvailable
            ? 'available'
            : 'current',
        remote,
        updateAvailable,
        checkedAt:
          new Date().toISOString(),
        error: null
      });

      const registration =
        await getRegistration();

      if (registration) {
        await registration.update();
      }

      logger.info(
        'Version check completed',
        {
          currentVersion:
            VERSION_INFO.version,
          currentBuild:
            VERSION_INFO.build,
          remoteVersion:
            remote?.version || '',
          remoteBuild:
            remote?.build || '',
          updateAvailable
        }
      );

      if (notify) {
        if (updateAvailable) {
          toast.warning(
            `Update ${remote.version} tersedia.`,
            {
              key:
                'portal-update-available',
              duration: 5000
            }
          );
        } else {
          toast.success(
            'Portal sudah menggunakan versi terbaru.',
            {
              key:
                'portal-update-current'
            }
          );
        }
      }

      return this.snapshot();
    } catch (error) {
      setState({
        status: 'error',
        checkedAt:
          new Date().toISOString(),
        error:
          error.message
      });

      logger.error(
        'Version check failed',
        {
          message:
            error.message
        }
      );

      if (notify) {
        toast.error(
          'Pemeriksaan update gagal.',
          {
            key:
              'portal-update-check-error'
          }
        );
      }

      throw error;
    }
  },

  async apply({
    reload = true
  } = {}) {
    setState({
      status: 'applying',
      error: null
    });

    try {
      const registration =
        await getRegistration();

      if (registration) {
        await registration.update();

        const worker =
          registration.waiting ||
          registration.installing;

        if (worker) {
          worker.postMessage({
            type: 'SKIP_WAITING'
          });
        }
      }

      /*
       * Hapus hanya Cache Storage milik service worker.
       * Cache data user di localStorage tidak disentuh.
       */
      if ('caches' in window) {
        const keys =
          await caches.keys();

        await Promise.all(
          keys
            .filter((key) =>
              key.startsWith(
                'portal-v3-runtime-'
              )
            )
            .map((key) =>
              caches.delete(key)
            )
        );
      }

      setState({
        status: 'applied',
        updateAvailable: false,
        error: null
      });

      logger.info(
        'Portal update applied'
      );

      if (reload) {
        window.location.reload();
      }

      return this.snapshot();
    } catch (error) {
      setState({
        status: 'error',
        error:
          error.message
      });

      logger.error(
        'Portal update apply failed',
        {
          message:
            error.message
        }
      );

      toast.error(
        'Penerapan update gagal.',
        {
          key:
            'portal-update-apply-error'
        }
      );

      throw error;
    }
  },

  getCurrentVersion() {
    return {
      ...VERSION_INFO
    };
  },

  snapshot() {
    return {
      ...state,
      current: {
        ...state.current
      },
      remote:
        state.remote
          ? { ...state.remote }
          : null
    };
  }
};
