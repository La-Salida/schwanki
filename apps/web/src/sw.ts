/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

// registerType "autoUpdate": a new deploy takes over open tabs instead of waiting
// for every installed-app window to close.
void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA shell for every in-app URL, so /inbox or /settings open offline from the home screen.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// Archivo from Google Fonts: the CSS changes rarely, the font files never do
// (fonts load with CORS, so only real 200s get cached).
registerRoute(({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-css" }));
registerRoute(({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({ cacheName: "google-fonts-files" }));

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
