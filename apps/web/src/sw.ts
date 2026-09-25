/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  const data = event.data?.json() as { title: string; body: string };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
