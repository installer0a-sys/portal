const CACHE_VERSION = 'portal-v3-runtime-v0.6.3a';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const BASE_PATH = '/portal/';
const OFFLINE_FALLBACK = '/portal/';

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        '/portal/icons/icon-192.svg',
        '/portal/icons/icon-512.svg',
        '/portal/manifests/portal.webmanifest',
        '/portal/manifests/app-a.webmanifest'
      ])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(PAGE_CACHE),
        caches.delete(STATIC_CACHE)
      ])
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (!url.pathname.startsWith(BASE_PATH)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker'
  ) {
    event.respondWith(networkFirstAsset(request));
    return;
  }

  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest'
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, {
      cache: 'no-store'
    });

    if (response && response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    const fallback = await caches.match(OFFLINE_FALLBACK);

    if (fallback) {
      return fallback;
    }

    return new Response(
      `<!doctype html>
      <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Portal Offline</title>
        </head>
        <body style="font-family:system-ui;padding:24px">
          <h1>Portal sedang offline</h1>
          <p>Periksa koneksi lalu muat ulang halaman.</p>
        </body>
      </html>`,
      {
        headers: {
          'Content-Type': 'text/html;charset=utf-8'
        }
      }
    );
  }
}

async function networkFirstAsset(request) {
  try {
    const response = await fetch(request, {
      cache: 'no-store'
    });

    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    return new Response('', {
      status: 504,
      statusText: 'Gateway Timeout'
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cached || networkPromise;
}
