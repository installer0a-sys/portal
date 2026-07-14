import { logger } from '../core/logger.js';

const registry = new Map();

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest aplikasi tidak valid.');
  }

  const id = String(manifest.id || '').trim();

  if (!id) {
    throw new Error('Manifest aplikasi wajib memiliki id.');
  }

  if (!manifest.title) {
    throw new Error(
      `Manifest ${id} wajib memiliki title.`
    );
  }

  if (typeof manifest.loader !== 'function') {
    throw new Error(
      `Manifest ${id} wajib memiliki loader.`
    );
  }

  return {
    id,
    title: String(manifest.title),
    shortTitle: String(
      manifest.shortTitle ||
      manifest.title
    ),
    description: String(
      manifest.description || ''
    ),
    icon: String(
      manifest.icon || 'app'
    ),
    version: String(
      manifest.version || '0.1.0'
    ),
    route: String(
      manifest.route || id
    ),
    order: Number(
      manifest.order || 100
    ),
    menu: manifest.menu !== false,
    standalone:
      manifest.standalone === true,
    enabled:
      manifest.enabled !== false,
    requiredPermission: String(
      manifest.requiredPermission || ''
    ),
    loader: manifest.loader
  };
}

export const appRegistry = {
  register(manifest) {
    const normalized =
      validateManifest(manifest);

    registry.set(
      normalized.id,
      normalized
    );

    logger.info(
      'App manifest registered',
      {
        appId: normalized.id,
        route: normalized.route,
        version: normalized.version
      }
    );

    return normalized;
  },

  registerMany(manifests = []) {
    return manifests.map(
      (manifest) =>
        this.register(manifest)
    );
  },

  get(id) {
    return registry.get(
      String(id || '')
    ) || null;
  },

  getByRoute(route) {
    const value =
      String(route || '');

    return (
      [...registry.values()].find(
        (item) =>
          item.route === value
      ) || null
    );
  },

  list({
    menuOnly = false,
    enabledOnly = true
  } = {}) {
    return [...registry.values()]
      .filter((item) => {
        if (
          menuOnly &&
          !item.menu
        ) {
          return false;
        }

        if (
          enabledOnly &&
          !item.enabled
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          a.order - b.order
      );
  },

  clear() {
    registry.clear();
  },

  snapshot() {
    return {
      count: registry.size,
      apps: this.list({
        enabledOnly: false
      }).map((item) => ({
        id: item.id,
        title: item.title,
        route: item.route,
        version: item.version,
        menu: item.menu,
        standalone:
          item.standalone,
        enabled:
          item.enabled,
        requiredPermission:
          item.requiredPermission
      }))
    };
  }
};
