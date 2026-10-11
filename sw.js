const CACHE_NAME = 'kscor-v860-2000f-offline';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1. INSTALLATION
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (let url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('Ressource non mise en cache (ignorée):', url, e);
        }
      }
    })
  );
});

// 2. ACTIVATION
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTION ET STRATÉGIE OFF-LINE
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET (ex: POST, PUT) car le Cache Storage accepte uniquement GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      // Si la ressource existe déjà en cache, la renvoyer immédiatement
      if (cached) return cached;

      // Sinon, essayer de la récupérer sur le réseau
      return fetch(event.request).then(networkRes => {
        // Vérifier si la réponse est valide
        if (!networkRes || networkRes.status !== 200 || networkRes.type !== 'basic') {
          return networkRes;
        }

        // Mettre en cache uniquement les requêtes GET du même origine
        if (event.request.url.startsWith(self.location.origin)) {
          const responseToCache = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkRes;
      }).catch(() => {
        // En cas de panne de réseau totale, servir index.html pour les navigations
        const isHTML = event.request.mode === 'navigate' || 
                       (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

        if (isHTML) {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
