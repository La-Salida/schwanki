/** Minimal Stripe helpers over fetch + WebCrypto (no SDK in the edge bundle). */

const enc = new TextEncoder();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifies a `Stripe-Signature` header (t=…,v1=…) against the raw body.
 *  Rejects signatures older than `toleranceSec` to block replays. */
export async function verifyStripeSignature(
  rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("=", 2) as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const v1s = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || v1s.length === 0) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return v1s.some((v) => safeEqual(v, expected));
}

/** Test helper and webhook-forging counterpart: builds a valid header for a body. */
export async function signStripePayload(rawBody: string, secret: string, t: number): Promise<string> {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${rawBody}`)}`;
}

export async function stripeRequest(secretKey: string, path: string, form: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<Record<string, unknown>> {
  const params = new URLSearchParams(form);
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" ? `?${params}` : ""}`, {
    method,
    headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" },
    ...(method === "POST" ? { body: params } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as { message?: string } | undefined)?.message ?? `Stripe HTTP ${res.status}`);
  return json;
}

/** Only send buyers back to an https origin (or a local dev server). */
export function safeReturnOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.protocol === "https:") return u.origin;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u.origin;
  } catch { /* not a URL */ }
  return null;
}
