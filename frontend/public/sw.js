const STATIC_CACHE = 'portal-static-v0.1.0';
const STATIC_FILES = ['/portal/', '/portal/app-a/'];
self.addEventListener('install', event => event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('portal-static-') && key !== STATIC_CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
