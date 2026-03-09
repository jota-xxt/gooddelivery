// Push notification handler for Good Delivery PWA
self.addEventListener("push", (event) => {
  const defaultData = { title: "Good Delivery", body: "Você tem uma nova notificação", icon: "/pwa-192x192.png" };
  let data = defaultData;

  try {
    if (event.data) {
      data = { ...defaultData, ...event.data.json() };
    }
  } catch {
    data = defaultData;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/pwa-192x192.png",
      badge: data.badge || "/pwa-192x192.png",
      vibrate: [200, 100, 200],
      tag: "good-delivery-notification",
      renotify: true,
      data: data,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/");
    })
  );
});
