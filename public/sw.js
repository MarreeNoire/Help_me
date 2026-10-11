/* Help_me — service worker : notifications push urgentes + clic sur notification */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Help_me", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "🚨 ALERTE SOS Help_me";

  // Vibration d'urgence en morse S-O-S (... --- ...) : 3 courts, 3 longs, 3 courts
  const sosVibrate = [
    200, 100, 200, 100, 200, 300, 400, 100, 400, 100, 400, 300, 200, 100, 200, 100, 200,
  ];

  const options = {
    body: data.body || "Un proche a besoin d'aide en urgence !",
    icon: "/icons/192",
    badge: "/icons/192",
    tag: data.tag || "help-me-alert",
    sound: "/alarm.wav",
    silent: false,
    renotify: true,
    requireInteraction: true,
    vibrate: sosVibrate,
    data: {
      url: data.url || "/",
      alertId: data.alertId,
    },
  };

  event.waitUntil(
    (async () => {
      // 1. Avertit tous les onglets ouverts (y compris en arrière-plan) pour déclencher l'alarme sonore immédiatement
      try {
        const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({
            type: "SOS_ALERT_TRIGGERED",
            alertId: data.alertId,
            url: data.url || "/",
          });
        }
      } catch (err) {
        /* ignore */
      }

      // 2. Affiche la notification push avec son et vibration SOS
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
