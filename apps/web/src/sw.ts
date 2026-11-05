/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

// registerType "autoUpdate": a new deploy takes over open tabs instead of waiting
// for every installed-app window to close.
void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Page loads ask the network first, so a deploy shows up on the next load instead of after
// the old cached page has run once (the landing looked undeployed on 2026-11-05 for exactly
// that reason). The page names hashed bundles, so fresh HTML means fresh code. Offline, or
// when the network takes over 3 seconds, the last copy of that page or the precached SPA
// shell opens instead, so /inbox or /settings still open from the home screen.
// Real files (sitemap.xml, robots.txt, the IndexNow key) go to the network, or opening them
// in a browser that has the app installed shows the landing page instead.
const pages = new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3 });
registerRoute(new NavigationRoute(async (options) => {
  try {
    return await pages.handle(options);
  } catch {
    // Looked up here because the precache list is only registered further down.
    return createHandlerBoundToURL("/index.html")(options);
  }
}, {
  denylist: [/\.(xml|txt|json|webmanifest)$/],
}));

// After the page route: Workbox uses the first route that matches, and the precache route
// also answers "/" (from its cached index.html), which would put the stale page back.
precacheAndRoute(self.__WB_MANIFEST);

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
