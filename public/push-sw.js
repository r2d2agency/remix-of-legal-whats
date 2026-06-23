// Push notification service worker handler
// This file is imported by the workbox-generated service worker

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();

    event.waitUntil((async () => {
      // If the app is open AND visible in any window, suppress the OS push
      // notification — the in-app sound/toast will handle it. This avoids
      // the "double beep" (push sound + in-app sound) when the user is
      // already looking at the app.
      // Exception: explicit test pushes (tag === 'push-test') always show.
      const isTest = data.tag === 'push-test';
      if (!isTest) {
        const clientsList = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        const hasVisibleClient = clientsList.some(
          (c) => c.visibilityState === 'visible' && c.focused
        );
        if (hasVisibleClient) {
          return; // app is in foreground — skip OS notification
        }
      }

      const options = {
        body: data.body || '',
        icon: data.icon || '/icons/icon-192.png?v=2',
        badge: data.badge || '/icons/icon-96.png?v=2',
        vibrate: data.vibrate || [200, 100, 200, 100, 200],
        data: {
          url: data.url || '/',
          ...data.data,
        },
        actions: data.actions || [],
        tag: data.tag || 'default',
        silent: false,
        renotify: true,
        requireInteraction: data.requireInteraction || false,
      };

      await self.registration.showNotification(data.title || 'Glee-go Whats', options);
    })());
  } catch (err) {
    console.error('Push event error:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Optional: track notification dismissals
  console.log('Notification closed:', event.notification.tag);
});
