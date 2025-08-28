/// <reference lib="webworker" />

const CACHE_NAME = 'wctask-cache-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

const sw = self as unknown as ServiceWorkerGlobalScope

sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE)
    }),
  )
  // Force the waiting service worker to become the active service worker.
  sw.skipWaiting()
})

sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
          return Promise.resolve(false)
        }),
      )
    }),
  )
  // Tell the active service worker to take control of the page immediately.
  sw.clients.claim()
})

sw.addEventListener('fetch', (event: FetchEvent) => {
  // Only cache GET requests.
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request).then((response) => {
        // Don't cache if not a success response, or it's a cross-origin request.
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }

        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })

        return response
      }).catch(async () => {
        // Fallback for offline if needed (e.g., return a cached offline.html).
        const fallback = await caches.match('/')
        if (fallback) return (fallback as Response)
        throw new Error('Offline and no cache fallback.')
      })
    }),
  )
})

sw.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    sw.skipWaiting()
  }
})
