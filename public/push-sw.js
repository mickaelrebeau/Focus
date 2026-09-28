// Importé par le service worker généré par Workbox (voir pwa.workbox.importScripts).
// Affiche les notifications push envoyées par le serveur et gère le clic.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Focus', {
    body: data.body || '',
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    tag: data.tag,
    data: { url: data.url || '/app' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/app', self.location.origin).href

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target)
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
