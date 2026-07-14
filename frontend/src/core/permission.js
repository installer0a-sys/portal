import {
  getPortalRole,
  getAppRole,
  getPermissions
} from './access.js';
import { logger } from './logger.js';

function normalize(value) {
  return String(value || '').trim();
}

function permissionMatches(granted, required) {
  const grant = normalize(granted);
  const need = normalize(required);

  if (!grant || !need) {
    return false;
  }

  if (grant === '*' || grant === need) {
    return true;
  }

  if (grant.endsWith('.*')) {
    const prefix = grant.slice(0, -1);
    return need.startsWith(prefix);
  }

  return false;
}

function getAppIdFromPermission(permission) {
  const value = normalize(permission);

  if (!value.includes('.')) {
    return '';
  }

  return value.split('.')[0];
}

function hasRoleFallback(session, permission) {
  const required = normalize(permission);

  if (!required) {
    return true;
  }

  const portalRole =
    normalize(getPortalRole(session))
      .toUpperCase();

  if (portalRole === 'ADMIN') {
    return true;
  }

  if (
    required === 'portal.access' &&
    portalRole !== 'NONE'
  ) {
    return true;
  }

  const appId =
    getAppIdFromPermission(required);

  if (!appId || appId === 'portal') {
    return false;
  }

  const appRole =
    normalize(
      getAppRole(session, appId)
    ).toUpperCase();

  if (
    required === `${appId}.access` &&
    appRole !== 'NONE'
  ) {
    return true;
  }

  return false;
}

export const permissionEngine = {
  can(session, permission) {
    const required =
      normalize(permission);

    if (!required) {
      return true;
    }

    const granted =
      getPermissions(session);

    const allowed =
      granted.some((item) =>
        permissionMatches(
          item,
          required
        )
      ) ||
      hasRoleFallback(
        session,
        required
      );

    logger.info(
      'Permission evaluated',
      {
        permission: required,
        allowed
      }
    );

    return allowed;
  },

  canAny(session, permissions = []) {
    const list =
      Array.isArray(permissions)
        ? permissions
        : [permissions];

    if (list.length === 0) {
      return true;
    }

    return list.some(
      (permission) =>
        this.can(
          session,
          permission
        )
    );
  },

  canAll(session, permissions = []) {
    const list =
      Array.isArray(permissions)
        ? permissions
        : [permissions];

    if (list.length === 0) {
      return true;
    }

    return list.every(
      (permission) =>
        this.can(
          session,
          permission
        )
    );
  },

  canAccessManifest(session, manifest) {
    if (!manifest?.enabled) {
      return false;
    }

    return this.can(
      session,
      manifest.requiredPermission
    );
  },

  filterManifests(session, manifests = []) {
    return manifests.filter(
      (manifest) =>
        this.canAccessManifest(
          session,
          manifest
        )
    );
  },

  filterInternalMenu(
    session,
    items = []
  ) {
    return items.filter(
      (item) =>
        item.enabled !== false &&
        this.can(
          session,
          item.requiredPermission
        )
    );
  },

  firstAllowedInternalRoute(
    session,
    manifest
  ) {
    const items =
      this.filterInternalMenu(
        session,
        manifest?.internalMenu || []
      );

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

  guard(
    session,
    permission,
    message =
      'Anda tidak memiliki izin.'
  ) {
    if (
      this.can(
        session,
        permission
      )
    ) {
      return true;
    }

    const error =
      new Error(message);

    error.code =
      'PERMISSION_DENIED';

    throw error;
  },

  snapshot(session) {
    return {
      portalRole:
        getPortalRole(session),
      permissions:
        getPermissions(session),
      evaluatedAt:
        new Date().toISOString()
    };
  }
};
