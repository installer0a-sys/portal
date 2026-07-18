import { logger } from '../core/logger.js';
import {
  normalizeManifest,
  validateManifestCollection
} from './manifest-schema.js';

const registry = new Map();
const routeIndex = new Map();

function addToIndexes(manifest) {
  registry.set(
    manifest.id,
    manifest
  );

  routeIndex.set(
    manifest.route,
    manifest.id
  );
}

export const appRegistry = {
  register(manifest) {
    const normalized =
      normalizeManifest(manifest);

    const existingByRoute =
      routeIndex.get(normalized.route);

    if (
      existingByRoute &&
      existingByRoute !== normalized.id
    ) {
      throw new Error(
        `Route ${normalized.route} sudah dipakai oleh ${existingByRoute}.`
      );
    }

    addToIndexes(normalized);

    logger.info(
      'App manifest registered',
      {
        appId: normalized.id,
        route: normalized.route,
        version: normalized.version,
        schemaVersion:
          normalized.schemaVersion
      }
    );

    return normalized;
  },

  registerMany(manifests = []) {
    const normalized =
      validateManifestCollection(
        manifests
      );

    normalized.forEach(
      addToIndexes
    );

    normalized.forEach(
      (manifest) => {
        logger.info(
          'App manifest registered',
          {
            appId: manifest.id,
            route: manifest.route,
            version: manifest.version,
            schemaVersion:
              manifest.schemaVersion
          }
        );
      }
    );

    return normalized;
  },

  applyCatalog(records = []) {
    if (!Array.isArray(records)) {
      return [];
    }

    const updated = [];

    records.forEach((record) => {
      const appId = String(
        record?.appId ||
        record?.APP_ID ||
        ''
      ).trim();

      const current = registry.get(appId);

      if (!current) {
        return;
      }

      const appName = String(
        record?.appName ||
        record?.APP_NAME ||
        ''
      ).trim();

      const description = String(
        record?.description ||
        record?.DESCRIPTION ||
        ''
      ).trim();

      const category = String(
        record?.category ||
        record?.CATEGORY ||
        ''
      ).trim();

      const status = String(
        record?.status ||
        record?.STATUS ||
        'ACTIVE'
      ).trim().toUpperCase();

      const sortOrder = Number(
        record?.sortOrder ??
        record?.SORT_ORDER ??
        current.order
      );

      const merged = {
        ...current,
        title: appName || current.title,
        shortTitle: appName || current.shortTitle || current.title,
        description: description || current.description,
        category: category || current.category,
        order: Number.isFinite(sortOrder)
          ? sortOrder
          : current.order,
        enabled: status === 'ACTIVE',
        catalog: {
          ...(current.catalog || {}),
          ...record
        }
      };

      registry.set(appId, merged);
      updated.push(merged);
    });

    return updated;
  },

  get(id) {
    return registry.get(
      String(id || '')
    ) || null;
  },

  getByRoute(route) {
    const id =
      routeIndex.get(
        String(route || '')
      );

    return id
      ? this.get(id)
      : null;
  },

  has(id) {
    return registry.has(
      String(id || '')
    );
  },

  list({
    menuOnly = false,
    enabledOnly = true,
    category = ''
  } = {}) {
    const categoryText =
      String(category || '').trim();

    return [...registry.values()]
      .filter((manifest) => {
        if (
          menuOnly &&
          !manifest.menu
        ) {
          return false;
        }

        if (
          enabledOnly &&
          !manifest.enabled
        ) {
          return false;
        }

        if (
          categoryText &&
          manifest.category !== categoryText
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          a.order - b.order ||
          a.title.localeCompare(
            b.title,
            'id'
          )
      );
  },

  categories() {
    return [
      ...new Set(
        this.list({
          enabledOnly: false
        })
          .map(
            (manifest) =>
              manifest.category
          )
          .filter(Boolean)
      )
    ];
  },

  getInternalMenu(
    appId,
    {
      enabledOnly = true
    } = {}
  ) {
    const manifest =
      this.get(appId);

    if (!manifest) {
      return [];
    }

    return manifest.internalMenu
      .filter(
        (item) =>
          !enabledOnly ||
          item.enabled
      )
      .sort(
        (a, b) =>
          a.order - b.order
      );
  },

  getDefaultInternalRoute(appId) {
    const items =
      this.getInternalMenu(appId);

    const preferred =
      items.find(
        (item) => item.default
      );

    return (
      preferred?.route ||
      items[0]?.route ||
      ''
    );
  },

  unregister(id) {
    const manifest =
      this.get(id);

    if (!manifest) {
      return false;
    }

    registry.delete(manifest.id);
    routeIndex.delete(
      manifest.route
    );

    logger.info(
      'App manifest unregistered',
      {
        appId: manifest.id
      }
    );

    return true;
  },

  clear() {
    registry.clear();
    routeIndex.clear();
  },

  snapshot() {
    return {
      count: registry.size,
      categories:
        this.categories(),
      apps:
        this.list({
          enabledOnly: false
        }).map((manifest) => ({
          schemaVersion:
            manifest.schemaVersion,
          id:
            manifest.id,
          title:
            manifest.title,
          category:
            manifest.category,
          route:
            manifest.route,
          version:
            manifest.version,
          menu:
            manifest.menu,
          enabled:
            manifest.enabled,
          requiredPermission:
            manifest.requiredPermission,
          tags:
            manifest.tags,
          standalone:
            manifest.standalone,
          capabilities:
            manifest.capabilities,
          internalMenu:
            manifest.internalMenu.map(
              (item) => ({
                id:
                  item.id,
                title:
                  item.title,
                route:
                  item.route,
                enabled:
                  item.enabled,
                default:
                  item.default,
                requiredPermission:
                  item.requiredPermission
              })
            )
        }))
    };
  }
};
