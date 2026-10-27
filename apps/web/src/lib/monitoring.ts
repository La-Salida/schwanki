import * as Sentry from "@sentry/react";

// Public by design: a DSN only lets a client send events to this project.
const DSN = "https://d7711f969b7ca7d09767f0efd9f74ae3@o4509846722183168.ingest.us.sentry.io/4512327250542592";

/** Crash and error reporting for production builds. No tracing or replays, and no personal data. */
export function startMonitoring() {
  if (!import.meta.env.PROD) return;
  Sentry.init({
    dsn: DSN,
    environment: location.hostname === "schwankiapp.com" || location.hostname === "www.schwankiapp.com" ? "production" : "staging",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Noise that says nothing about Schwanki: extensions, flaky networks and aborted fetches.
    ignoreErrors: ["ResizeObserver loop", "Failed to fetch", "NetworkError when attempting to fetch resource", "Load failed", "AbortError"],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
  });
}

/** Tag errors with the account id (never the email) so one user's reports group together. */
export function identifyUser(userId: string | null) {
  Sentry.setUser(userId ? { id: userId } : null);
}

export const ErrorBoundary = Sentry.ErrorBoundary;
