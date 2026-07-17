import { getPortalRole, getAppAccess, getPermissions } from './access.js';
import { logger } from './logger.js';
const normalize = (value) => String(value || '').trim();
const appIdFromPermission = (permission) => normalize(permission).split('.')[0] || '';
function permissionMatches(granted, required) {
  const grant = normalize(granted); const need = normalize(required);
  if (!grant || !need) return false;
  if (grant === '*' || grant === need) return true;
  return grant.endsWith('.*') && need.startsWith(grant.slice(0, -1));
}

export const permissionEngine = {
  getAppGate(session, appId) {
    const access = getAppAccess(session, appId);
    if (!access.access) return { allowed: false, visible: false, reason: 'NO_ACCESS', ...access };
    if (access.status !== 'ACTIVE') return { allowed: false, visible: true, reason: 'INACTIVE', ...access };
    if (!access.role || access.role === 'NONE') return { allowed: false, visible: true, reason: 'NO_ROLE', ...access };
    return { allowed: true, visible: true, reason: '', ...access };
  },
  isReadOnly(session, appId) { return getAppAccess(session, appId).role === 'USER'; },
  isAppAdmin(session, appId) { return getAppAccess(session, appId).role === 'ADMIN'; },
  can(session, permission) {
    const required = normalize(permission);
    if (!required) return true;
    const portalRole = getPortalRole(session);
    if (required === 'portal.access') return portalRole !== 'NONE';
    if (required.startsWith('portal.') && portalRole === 'ADMIN') return true;
    const appId = appIdFromPermission(required);
    if (appId && appId !== 'portal') {
      const gate = this.getAppGate(session, appId);
      if (!gate.allowed) return false;
      if (required === `${appId}.access`) return true;
      if (gate.role === 'ADMIN') return true;
      if (gate.role === 'USER' && /\.(view|read|filter|search|chart|export)$/.test(required)) return true;
    }
    const allowed = getPermissions(session).some((item) => permissionMatches(item, required));
    logger.info('Permission evaluated', { permission: required, allowed });
    return allowed;
  },
  canAny(session, permissions = []) { const list = Array.isArray(permissions) ? permissions : [permissions]; return !list.length || list.some((p) => this.can(session, p)); },
  canAll(session, permissions = []) { const list = Array.isArray(permissions) ? permissions : [permissions]; return !list.length || list.every((p) => this.can(session, p)); },
  canListManifest(session, manifest) {
    if (!manifest?.enabled) return false;
    if (manifest.id === 'dashboard') return true;
    return this.getAppGate(session, manifest.id).visible;
  },
  canAccessManifest(session, manifest) {
    if (!manifest?.enabled) return false;
    if (manifest.id === 'dashboard') return true;
    return this.getAppGate(session, manifest.id).allowed;
  },
  filterManifests(session, manifests = []) { return manifests.filter((m) => this.canListManifest(session, m)); },
  filterInternalMenu(session, items = [], appId = '') {
    return items.filter((item) => item.enabled !== false && (!item.adminOnly || this.isAppAdmin(session, appId)) && this.can(session, item.requiredPermission));
  },
  firstAllowedInternalRoute(session, manifest) {
    const items = this.filterInternalMenu(session, manifest?.internalMenu || [], manifest?.id);
    return items.find((item) => item.default)?.route || items[0]?.route || '';
  },
  guard(session, permission, message = 'Anda tidak memiliki izin.') { if (this.can(session, permission)) return true; const error = new Error(message); error.code = 'PERMISSION_DENIED'; throw error; },
  snapshot(session) { return { portalRole: getPortalRole(session), permissions: getPermissions(session), evaluatedAt: new Date().toISOString() }; }
};
