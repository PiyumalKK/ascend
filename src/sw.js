/// <reference lib="webworker" />
// ASCEND service worker: offline app shell, font caching, and Web Push notifications.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA: every navigation serves the cached index.html. API routes are never intercepted.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// ---------------------------------------------------------------- push
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'ASCEND', body: event.data?.text() }
  }
  const title = payload.title || 'ASCEND'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      tag: payload.tag || undefined,
      renotify: !!payload.tag,
      vibrate: [120, 60, 120],
      data: { url: payload.url || '/', reminderId: payload.reminderId || null },
      actions: payload.reminderId ? [{ action: 'done', title: 'Done ✓' }] : [],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url, reminderId } = event.notification.data || {}
  const target = event.action === 'done' && reminderId ? `/?done=${reminderId}` : url || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if ('focus' in c) {
          await c.navigate(target).catch(() => {})
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    })(),
  )
})
