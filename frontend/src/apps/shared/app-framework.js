import { permissionEngine } from '../../core/permission.js';

export function createAppAccess(session, appId) {
  const permission = (name) => {
    const value = String(name || '').trim();
    return value.startsWith(`${appId}.`) ? value : `${appId}.${value}`;
  };

  return Object.freeze({
    appId,
    role: permissionEngine.getAppGate(session, appId).role || '',
    gate: permissionEngine.getAppGate(session, appId),
    can: (name) => permissionEngine.can(session, permission(name)),
    canCreate: () => permissionEngine.can(session, permission('data.create')),
    canEdit: () => permissionEngine.can(session, permission('data.edit')),
    canDelete: () => permissionEngine.can(session, permission('data.delete')),
    canExport: () => permissionEngine.can(session, permission('export')),
    canOpenAdminPanel: () => permissionEngine.isAppAdmin(session, appId),
    isReadOnly: () => permissionEngine.isReadOnly(session, appId)
  });
}
