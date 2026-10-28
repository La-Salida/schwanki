import * as Sentry from "@sentry/deno";
import { corsJson } from "./cors.ts";

// Public by design: a DSN only lets a client send events to the schwanki-functions project.
const DSN = "https://11577ca6591b686c258ae34ca4260f84@o4509846722183168.ingest.us.sentry.io/4512331955830784";

// Only report from the deployed edge runtime (it sets SB_REGION), never from tests or local serve.
const enabled = Boolean(Deno.env.get("SB_REGION")) && Deno.env.get("SENTRY_DISABLED") !== "1";

type Handler = (request: Request) => Response | Promise<Response>;

/** Deno.serve with error reporting: uncaught throws and 5xx responses go to Sentry, tagged by function. */
export function serve(fn: string, handler: Handler) {
  if (enabled) {
    // Default integrations patch globals and keep state across requests, which the edge runtime shares.
    Sentry.init({ dsn: Deno.env.get("SENTRY_DSN") || DSN, defaultIntegrations: false, tracesSampleRate: 0, sendDefaultPii: false, environment: "production" });
    Sentry.setTag("function", fn);
    Sentry.setTag("region", Deno.env.get("SB_REGION") ?? "unknown");
  }
  return Deno.serve(async (request) => {
    try {
      const response = await handler(request);
      if (enabled && response.status >= 500) {
        Sentry.withScope((scope) => {
          scope.setTag("status", String(response.status));
          scope.setContext("request", { method: request.method, path: new URL(request.url).pathname });
          Sentry.captureMessage(`${fn} responded ${response.status}`, "error");
        });
        await Sentry.flush(2000);
      }
      return response;
    } catch (error) {
      console.error(`${fn} crashed`, error);
      if (enabled) {
        Sentry.withScope((scope) => {
          scope.setContext("request", { method: request.method, path: new URL(request.url).pathname });
          Sentry.captureException(error);
        });
        await Sentry.flush(2000);
      }
      return corsJson({ error: "Something went wrong on our side. Try again." }, 500);
    }
  });
}
