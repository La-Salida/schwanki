/**
 * Classify a non-ok HTTP response from Google APIs.
 * 400/401/403 mean the grant or credentials are bad → "revoked" (needs user re-auth).
 * Everything else (429, 5xx, …) is transient → "error" (retried on the next sync).
 */
export function classifyHttpError(status: number): "revoked" | "error" {
  if (status === 400 || status === 401 || status === 403) return "revoked";
  return "error";
}
