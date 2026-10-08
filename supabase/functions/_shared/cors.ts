/** Browser-invoked functions run with verify_jwt = false (see config.toml): the
 *  gateway no longer rejects preflight requests, so each function must answer
 *  OPTIONS itself and stamp CORS headers on every response. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function corsJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}
