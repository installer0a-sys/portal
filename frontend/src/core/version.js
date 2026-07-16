export const VERSION_INFO = Object.freeze({
  app: 'portal-v3',
  version: '0.4.5',
  build: '2026.07.16.2',
  releasedAt: '2026-07-16T00:00:00.000Z'
});

function parsePart(value) {
  const parsed = Number.parseInt(
    String(value || '0'),
    10
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export function compareVersions(left, right) {
  const a = String(left || '0')
    .split('.')
    .map(parsePart);

  const b = String(right || '0')
    .split('.')
    .map(parsePart);

  const length = Math.max(
    a.length,
    b.length
  );

  for (let index = 0; index < length; index += 1) {
    const leftPart = a[index] || 0;
    const rightPart = b[index] || 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

export function isNewerVersion(
  candidate,
  current = VERSION_INFO.version
) {
  return compareVersions(
    candidate,
    current
  ) > 0;
}
