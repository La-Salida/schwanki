import { createClient } from "@supabase/supabase-js";
import { runGeneration } from "../generate-mnemonic/pipeline.ts";

/** Drains the async bulk-generation queue. Cron-only: rejects anything not bearing
 *  the service-role key (verify_jwt accepts any valid JWT, including the anon key).
 *  Claims a small batch (generations are slow — a per-minute drain of ~5 keeps a
 *  ~300 cards/hour pace without hammering providers) and runs each job through the
 *  SAME pipeline as the HTTP path, so billing/keys/partial-failure rules are identical.
 *  Outcomes: 200 → done · 429 rate-limited → back to pending +10min (attempts not
 *  burned) · anything else → failed with the error surfaced to the progress banner. */
Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: jobs, error } = await admin.rpc("claim_bulk_jobs", { batch_size: 5 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const done: string[] = [];
  const failed: string[] = [];
  let rateLimited = false;

  for (const job of jobs ?? []) {
    if (rateLimited) break; // leave the rest pending; the next cron tick retries
    const outcome = await runGeneration({ id: job.user_id as string }, {
      cardId: job.card_id as string,
      kinds: job.kinds as string[],
    });
    if (outcome.status === 200) {
      done.push(job.id as string);
      await admin.from("bulk_jobs").update({ status: "done", error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    } else if (outcome.status === 429) {
      // our-key hourly cap hit — requeue without burning the attempt
      rateLimited = true;
      await admin.from("bulk_jobs").update({
        status: "pending",
        attempts: Math.max(0, (job.attempts as number) - 1),
        run_after: new Date(Date.now() + 10 * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
    } else {
      failed.push(job.id as string);
      await admin.from("bulk_jobs").update({
        status: "failed",
        error: String(outcome.body.error ?? `HTTP ${outcome.status}`).slice(0, 300),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
    }
  }

  // Clean up finished jobs after a day so the progress table stays small.
  await admin.from("bulk_jobs")
    .delete()
    .in("status", ["done", "failed"])
    .lt("updated_at", new Date(Date.now() - 24 * 3600_000).toISOString());

  return Response.json({ claimed: jobs?.length ?? 0, done: done.length, failed: failed.length, rateLimited });
});
