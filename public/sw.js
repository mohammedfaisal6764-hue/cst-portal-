const CACHE_NAME = 'cst-portal-v1'

// Install
self.addEventListener('install', e => {
  self.skipWaiting()
})

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim())
})

// Push notification receive
self.addEventListener('push', e => {
  if (!e.data) return

  const data = e.data.json()
  const title   = data.title   || 'CST Portal'
  const options = {
    body:    data.body    || '',
    icon:    data.icon    || '/favicon.svg',
    badge:   '/favicon.svg',
    tag:     data.tag     || 'cst-notification',
    data:    { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: '👁️ দেখুন' },
      { action: 'dismiss', title: '❌ বন্ধ করুন' },
    ],
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.action === 'dismiss') return

  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          try { client.postMessage({ type: 'cst-go', url }) } catch (_) {}
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
  )
})
