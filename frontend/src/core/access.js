function normalizeText(value) { return String(value || '').trim(); }
function normalizeRole(value) { return normalizeText(value).toUpperCase(); }

export function getPortalRole(session) {
  return normalizeRole(
    session?.user?.portalRole || session?.access?.portal?.role || session?.access?.portalRole ||
    session?.profile?.user?.portalRole || session?.profile?.access?.portal?.role || 'NONE'
  ) || 'NONE';
}

function findAppEntry(session, appId) {
  const id = normalizeText(appId);
  if (!id) return null;
  const sources = [session?.access?.apps, session?.profile?.access?.apps];
  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      const match = source.find((item) => normalizeText(item?.appId || item?.appID || item?.APP_ID || item?.id).toLowerCase() === id.toLowerCase());
      if (match) return typeof match === 'string' ? { role: match } : match;
    } else if (typeof source === 'object') {
      const key = Object.keys(source).find((item) => item.toLowerCase() === id.toLowerCase());
      if (key) return typeof source[key] === 'string' ? { role: source[key] } : source[key];
    }
  }
  return null;
}

export function getAppAccess(session, appId) {
  const id = normalizeText(appId);
  const entry = findAppEntry(session, id);
  const roleMaps = [session?.access?.appRoles, session?.user?.appRoles, session?.profile?.access?.appRoles, session?.profile?.user?.appRoles];
  let fallbackRole = '';
  for (const map of roleMaps) {
    if (!map) continue;
    if (Array.isArray(map)) {
      const match = map.find((item) => normalizeText(item?.appId || item?.APP_ID || item?.id).toLowerCase() === id.toLowerCase());
      if (match) fallbackRole = normalizeRole(match?.role || match?.ROLE || match?.appRole || match);
    } else if (typeof map === 'object') {
      const key = Object.keys(map).find((item) => item.toLowerCase() === id.toLowerCase());
      if (key) fallbackRole = normalizeRole(map[key]?.role || map[key]);
    }
    if (fallbackRole) break;
  }
  const roles = Array.isArray(entry?.roles)
    ? entry.roles.map(normalizeRole).filter(Boolean)
    : Array.isArray(fallbackRole) ? fallbackRole.map(normalizeRole).filter(Boolean)
      : [normalizeRole(entry?.role || entry?.ROLE || entry?.appRole || fallbackRole)].filter(Boolean);
  return {
    access: entry ? entry.access !== false && String(entry.access ?? 'true').toUpperCase() !== 'FALSE' : roles.length > 0,
    status: normalizeRole(entry?.status || 'ACTIVE') || 'ACTIVE',
    role: roles[0] || '',
    roles: [...new Set(roles)]
  };
}

export function getAppRole(session, appId) { return getAppAccess(session, appId).role || 'NONE'; }

export function getPermissions(session) {
  const access = session?.access || session?.profile?.access || {};
  const values = [
    ...(Array.isArray(access.permissions) ? access.permissions : []),
    ...(Array.isArray(access.portal?.permissions) ? access.portal.permissions : [])
  ];
  if (access.apps && typeof access.apps === 'object' && !Array.isArray(access.apps)) {
    Object.values(access.apps).forEach((item) => { if (Array.isArray(item?.permissions)) values.push(...item.permissions); });
  }
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}
