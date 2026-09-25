/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  const fallback = { title: "Schwanki", body: "Cards are due. The notebook doesn't read itself." };
  let data = fallback;
  try {
    const parsed = event.data?.json() as { title?: unknown; body?: unknown } | undefined;
    if (parsed && typeof parsed.title === "string" && typeof parsed.body === "string") {
      data = { title: parsed.title, body: parsed.body };
    }
  } catch {
    data = fallback;
  }
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
