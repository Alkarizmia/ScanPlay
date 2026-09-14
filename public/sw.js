/* ScanPlay — PWA shell. Network-first for HTML/JS so deploys never leave a blank screen. */
const CACHE = 'scanplay-shell-v8';
const STATIC = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/logo.png'];
const NO_SPA_FALLBACK = new Set([
  '/avis',
  '/avis/',
  '/avis.html',
  '/avis-admin',
  '/avis-admin.html',
  '/privacy.html',
  '/terms.html',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(STATIC))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function isDocumentRequest(request) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') ?? '').includes('text/html')
  );
}

function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached ?? (fallbackUrl ? caches.match(fallbackUrl) : undefined)),
    );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;

  const { pathname } = new URL(request.url);

  // Never fall back review/legal pages to the SPA shell.
  if (NO_SPA_FALLBACK.has(pathname) || pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Always fetch fresh HTML and hashed bundles after each deploy.
  if (isDocumentRequest(request) || pathname.startsWith('/assets/')) {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }

  // Icons / manifest: cache-first is fine.
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});
