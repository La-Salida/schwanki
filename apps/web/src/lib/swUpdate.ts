import { registerSW } from "virtual:pwa-register";

// How often an open tab asks for a newer build. Chrome also checks on every navigation,
// but a tab or installed app left open for days never navigates, so it would run a stale
// bundle forever (seen 2026-10-27: a phone still used a sign-in flow removed a day earlier).
const CHECK_EVERY_MS = 15 * 60 * 1000;

/** Registers the service worker and reloads the page once a new build has taken over. */
export function keepAppFresh(): void {
  if (!("serviceWorker" in navigator)) return;
  let reloadPending = false;
  const reload = () => window.location.reload();

  registerSW({
    immediate: true,
    onNeedReload() {
      // Don't yank the page out from under someone mid-swipe: reload when the tab is
      // hidden, or the next time it comes back into view.
      if (document.visibilityState === "hidden") reload();
      else reloadPending = true;
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => { void registration.update().catch(() => { /* offline */ }); };
      window.setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          if (reloadPending) reload();
          else check();
        } else if (reloadPending) {
          reload();
        }
      });
    },
  });
}
