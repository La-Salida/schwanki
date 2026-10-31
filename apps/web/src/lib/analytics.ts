import * as amplitude from "@amplitude/analytics-browser";

// Public by design: a browser API key only lets a client send events to the Schwanki project.
const API_KEY = "7f9d39cb137d29350385c5d981d93abd";
const PRODUCTION_HOSTS = ["schwankiapp.com", "www.schwankiapp.com"];

let started = false;

/** Product analytics (Amplitude) on the production site only, so staging and local runs stay out
 *  of the numbers. Page views, sessions and UTM attribution are automatic; clicks and form
 *  contents are not captured, so card text never leaves the app. */
export function startAnalytics(hostname = location.hostname, prod = import.meta.env.PROD): boolean {
  if (started || !prod || !PRODUCTION_HOSTS.includes(hostname)) return started;
  amplitude.init(API_KEY, {
    autocapture: {
      attribution: true,
      pageViews: { trackHistoryChanges: "all" },
      sessions: true,
      formInteractions: false,
      fileDownloads: false,
      elementInteractions: false,
      frustrationInteractions: false,
      networkTracking: false,
      webVitals: false,
    },
    // Browser storage instead of cookies, as the privacy policy says.
    identityStorage: "localStorage",
    trackingOptions: { ipAddress: false },
  });
  started = true;
  return true;
}

/** Ties events to the Supabase account id (never the email). */
export function identifyAnalyticsUser(userId: string | null) {
  if (!started) return;
  if (userId) amplitude.setUserId(userId);
  else amplitude.reset();
}

export type AnalyticsEvent =
  | { name: "Account Created" }
  | { name: "Heard About Answered"; props: { answer: string } }
  | { name: "Anki Deck Imported"; props: { cards: number; duplicates: number } }
  | { name: "Notes Source Added"; props: { type: string; count: number } }
  | { name: "Card Reviewed"; props: { rating: string; is_new: boolean } }
  | { name: "Memory Aid Generated"; props: { kinds: string[] } }
  | { name: "Checkout Started"; props: { pack: string } }
  | { name: "Checkout Returned"; props: { outcome: "success" | "cancelled" } };

export function track(event: AnalyticsEvent) {
  if (!started) return;
  amplitude.track(event.name, "props" in event ? event.props : undefined);
}

/** User-level facts that should segment every chart, e.g. how they heard about Schwanki. */
export function setUserProperty(key: string, value: string) {
  if (!started) return;
  const identify = new amplitude.Identify();
  identify.setOnce(key, value);
  amplitude.identify(identify);
}

const ACCOUNT_CREATED_KEY = "schwanki.accountCreatedTracked";
const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

/** Sends "Account Created" once, for accounts made in the last half hour. */
export function noteAccountCreated(user: { id: string; created_at: string }, now = Date.now()) {
  if (!started || now - Date.parse(user.created_at) > NEW_ACCOUNT_WINDOW_MS) return;
  try {
    if (localStorage.getItem(ACCOUNT_CREATED_KEY) === user.id) return;
    localStorage.setItem(ACCOUNT_CREATED_KEY, user.id);
  } catch { /* storage blocked: may send twice, which is fine */ }
  track({ name: "Account Created" });
}
