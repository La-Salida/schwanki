import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const db = new PGlite();
const owner = "10000000-0000-0000-0000-000000000001";
const other = "10000000-0000-0000-0000-000000000002";
let cardId: string;
beforeAll(async () => {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;`);
  const read = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
  await db.exec(read("0001_initial.sql").replace("create extension if not exists pgcrypto;", ""));
  await db.exec(`grant select,insert,update on cards,card_state to authenticated;
    grant select,insert on review_events to authenticated;
    insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(read("20261021082243_atomic_review_save.sql"));
  // Acceptance previews may have installed the routine before migration replay.
  await db.exec(read("20261021082243_atomic_review_save.sql"));
}, 30_000);
beforeEach(async () => {
  cardId = (await db.query<{ id: string }>(`insert into cards(user_id,language,front,back) values($1,'en',$2,'meaning') returning id`, [owner, crypto.randomUUID()])).rows[0]!.id;
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
});
afterEach(() => db.exec("reset role"));
afterAll(() => db.close());

function payload(reps: number, at: string) {
  return {
    state: { cardId, dueAt: "2026-11-01T00:00:00Z", stability: reps, difficulty: 5, reps, lapses: 0, fsrs: { reps }, lastReviewedAt: at },
    event: { id: crypto.randomUUID(), cardId, reviewedAt: at, rating: "good", fsrsStateBefore: {} },
  };
}
async function save(p: ReturnType<typeof payload>) {
  return (await db.query<{ saved: boolean }>("select public.save_review($1::jsonb,$2::jsonb) as saved", [JSON.stringify(p.state), JSON.stringify(p.event)])).rows[0]!.saved;
}
async function snapshot() {
  return (await db.query("select reps,fsrs,last_reviewed_at from card_state where card_id=$1", [cardId])).rows[0];
}

it("never regresses a newer schedule when an acknowledged older event is retried", async () => {
  const first = payload(1, "2026-10-21T10:00:00Z");
  const later = payload(2, "2026-10-21T11:00:00Z");
  expect(await save(first)).toBe(true);
  expect(await save(later)).toBe(true);
  const latest = await snapshot();
  expect(await save(first)).toBe(false);
  expect(await snapshot()).toEqual(latest);
  expect((await db.query("select id from review_events where card_id=$1", [cardId])).rows).toHaveLength(2);
});

it("records a delayed unseen event without replacing the newer schedule", async () => {
  await save(payload(2, "2026-10-21T11:00:00Z"));
  const latest = await snapshot();
  expect(await save(payload(1, "2026-10-21T10:00:00Z"))).toBe(true);
  expect(await snapshot()).toEqual(latest);
});

it("rolls back the event when the schedule cannot be saved, allowing a clean retry", async () => {
  const p = payload(1, "2026-10-21T10:00:00Z");
  const invalid = { ...p, state: { ...p.state, fsrs: undefined } };
  await expect(save(invalid as unknown as typeof p)).rejects.toThrow();
  expect((await db.query("select id from review_events where card_id=$1", [cardId])).rows).toHaveLength(0);
  expect(await save(p)).toBe(true);
});

it("rejects mismatched cards and inaccessible owners without writes", async () => {
  const p = payload(1, "2026-10-21T10:00:00Z");
  await expect(save({ ...p, state: { ...p.state, cardId: crypto.randomUUID() } })).rejects.toThrow("card mismatch");
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
  await expect(save(p)).rejects.toThrow("card_state_card_id_fkey");
  await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);`);
  expect(await snapshot()).toBeUndefined();
});

it("denies anonymous callers and retains invoker security", async () => {
  await db.exec("set role anon");
  await expect(save(payload(1, "2026-10-21T10:00:00Z"))).rejects.toThrow("permission denied");
  await db.exec("reset role");
  expect((await db.query<{ prosecdef: boolean }>("select prosecdef from pg_proc where oid='public.save_review(jsonb,jsonb)'::regprocedure")).rows[0]!.prosecdef).toBe(false);
});
