function normalizeText(value) {
  return String(value || '').trim();
}

export function getPortalRole(session) {
  return normalizeText(
    session?.user?.portalRole ||
    session?.access?.portal?.role ||
    session?.access?.portalRole ||
    session?.profile?.user?.portalRole ||
    session?.profile?.access?.portal?.role ||
    'NONE'
  ) || 'NONE';
}

export function getAppRole(session, appId) {
  const id = normalizeText(appId);

  if (!id) {
    return 'NONE';
  }

  const possibleObjects = [
    session?.access?.apps?.[id],
    session?.access?.[id],
    session?.profile?.access?.apps?.[id],
    session?.profile?.access?.[id]
  ];

  for (const item of possibleObjects) {
    const role = normalizeText(
      typeof item === 'string'
        ? item
        : item?.role
    );

    if (role) {
      return role;
    }
  }

  const possibleMaps = [
    session?.user?.appRoles,
    session?.profile?.user?.appRoles,
    session?.access?.appRoles,
    session?.profile?.access?.appRoles
  ];

  for (const map of possibleMaps) {
    const role = normalizeText(map?.[id]);

    if (role) {
      return role;
    }
  }

  const possibleArrays = [
    session?.access?.apps,
    session?.access?.appRoles,
    session?.user?.appRoles,
    session?.profile?.access?.apps,
    session?.profile?.access?.appRoles,
    session?.profile?.user?.appRoles
  ];

  for (const list of possibleArrays) {
    if (!Array.isArray(list)) {
      continue;
    }

    const match = list.find((item) => {
      const itemId = normalizeText(
        item?.appId ||
        item?.appID ||
        item?.APP_ID ||
        item?.id
      );

      return itemId.toLowerCase() === id.toLowerCase();
    });

    const role = normalizeText(
      typeof match === 'string'
        ? match
        : match?.role ||
          match?.ROLE ||
          match?.appRole
    );

    if (role) {
      return role;
    }
  }

  return 'NONE';
}

export function getPermissions(session) {
  const access =
    session?.access ||
    session?.profile?.access ||
    {};

  const values = [
    ...(Array.isArray(access.permissions)
      ? access.permissions
      : []),
    ...(Array.isArray(access.portal?.permissions)
      ? access.portal.permissions
      : [])
  ];

  const apps = access.apps;

  if (apps && typeof apps === 'object' && !Array.isArray(apps)) {
    Object.values(apps).forEach((item) => {
      if (Array.isArray(item?.permissions)) {
        values.push(...item.permissions);
      }
    });
  }

  return [...new Set(values.map(normalizeText).filter(Boolean))];
}
