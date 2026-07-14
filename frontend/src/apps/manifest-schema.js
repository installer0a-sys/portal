const APP_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const ROUTE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function text(value) {
  return String(value ?? '').trim();
}

function boolean(value, fallback = false) {
  return typeof value === 'boolean'
    ? value
    : fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizeInternalMenu(items = []) {
  if (!Array.isArray(items)) {
    throw new Error(
      'internalMenu pada manifest harus berupa array.'
    );
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(
        `Item internalMenu ke-${index + 1} tidak valid.`
      );
    }

    const id = text(item.id);
    const title = text(item.title);

    if (!id) {
      throw new Error(
        `Item internalMenu ke-${index + 1} wajib memiliki id.`
      );
    }

    if (!title) {
      throw new Error(
        `Item internalMenu ${id} wajib memiliki title.`
      );
    }

    return {
      id,
      title,
      shortTitle:
        text(item.shortTitle) || title,
      description:
        text(item.description),
      icon:
        text(item.icon) || 'page',
      route:
        text(item.route) || id,
      order:
        number(item.order, (index + 1) * 10),
      enabled:
        boolean(item.enabled, true),
      default:
        boolean(item.default, index === 0),
      requiredPermission:
        text(item.requiredPermission)
    };
  });
}

function normalizeStandalone(value, appId) {
  if (value === true) {
    return {
      enabled: true,
      path: `/portal/${appId.toLowerCase()}/`,
      manifestPath: '',
      installable: true
    };
  }

  if (!value || value === false) {
    return {
      enabled: false,
      path: '',
      manifestPath: '',
      installable: false
    };
  }

  if (typeof value !== 'object') {
    throw new Error(
      'standalone harus berupa boolean atau object.'
    );
  }

  return {
    enabled:
      boolean(value.enabled, true),
    path:
      text(value.path),
    manifestPath:
      text(value.manifestPath),
    installable:
      boolean(value.installable, true)
  };
}

function normalizeCapabilities(value = {}) {
  if (!value || typeof value !== 'object') {
    return {
      offline: false,
      cache: false,
      notifications: false,
      backgroundSync: false
    };
  }

  return {
    offline:
      boolean(value.offline),
    cache:
      boolean(value.cache),
    notifications:
      boolean(value.notifications),
    backgroundSync:
      boolean(value.backgroundSync)
  };
}

export function normalizeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(
      'Manifest aplikasi tidak valid.'
    );
  }

  const id = text(manifest.id);
  const title = text(manifest.title);
  const route =
    text(manifest.route) || id;

  if (!id) {
    throw new Error(
      'Manifest aplikasi wajib memiliki id.'
    );
  }

  if (!APP_ID_PATTERN.test(id)) {
    throw new Error(
      `ID aplikasi tidak valid: ${id}`
    );
  }

  if (!title) {
    throw new Error(
      `Manifest ${id} wajib memiliki title.`
    );
  }

  if (!ROUTE_PATTERN.test(route)) {
    throw new Error(
      `Route aplikasi tidak valid: ${route}`
    );
  }

  if (typeof manifest.loader !== 'function') {
    throw new Error(
      `Manifest ${id} wajib memiliki loader().`
    );
  }

  return {
    schemaVersion:
      text(manifest.schemaVersion) || '1.0',
    id,
    title,
    shortTitle:
      text(manifest.shortTitle) || title,
    description:
      text(manifest.description),
    icon:
      text(manifest.icon) || 'app',
    category:
      text(manifest.category) || 'Umum',
    version:
      text(manifest.version) || '0.1.0',
    route,
    order:
      number(manifest.order, 100),
    menu:
      boolean(manifest.menu, true),
    enabled:
      boolean(manifest.enabled, true),
    requiredPermission:
      text(manifest.requiredPermission),
    tags:
      Array.isArray(manifest.tags)
        ? manifest.tags
            .map(text)
            .filter(Boolean)
        : [],
    standalone:
      normalizeStandalone(
        manifest.standalone,
        id
      ),
    capabilities:
      normalizeCapabilities(
        manifest.capabilities
      ),
    internalMenu:
      normalizeInternalMenu(
        manifest.internalMenu || []
      ),
    loader:
      manifest.loader
  };
}

export function validateManifestCollection(
  manifests = []
) {
  if (!Array.isArray(manifests)) {
    throw new Error(
      'Daftar manifest harus berupa array.'
    );
  }

  const normalized =
    manifests.map(normalizeManifest);

  const appIds = new Set();
  const routes = new Set();

  normalized.forEach((manifest) => {
    if (appIds.has(manifest.id)) {
      throw new Error(
        `Duplikasi app id: ${manifest.id}`
      );
    }

    if (routes.has(manifest.route)) {
      throw new Error(
        `Duplikasi route: ${manifest.route}`
      );
    }

    appIds.add(manifest.id);
    routes.add(manifest.route);
  });

  return normalized;
}
