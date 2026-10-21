import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const existing = {
  free: "10000000-0000-0000-0000-000000000001",
  paid: "10000000-0000-0000-0000-000000000002",
  unverified: "10000000-0000-0000-0000-000000000003",
  anonymous: "10000000-0000-0000-0000-000000000004",
  bonus: "10000000-0000-0000-0000-000000000005",
};
const read = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
const starterMigration = () => db.exec(read("20261021085913_free_starter_credits.sql"));

beforeAll(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz,
      is_anonymous boolean default false, raw_user_meta_data jsonb default '{}');
    create role anon; create role authenticated; create role service_role bypassrls;
    create role supabase_auth_admin;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,supabase_auth_admin;
    grant select,insert,update on auth.users to supabase_auth_admin;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
  `);
  await db.exec(read("0001_initial.sql").replace("create extension if not exists pgcrypto;", ""));
  await db.exec(read("0005_mnemonics.sql"));
  await db.exec(read("20261015060000_credit_purchases.sql"));
  await db.exec(read("20261021063605_core_api_grants.sql"));
  for (const [kind, id] of Object.entries(existing)) {
    await db.query("insert into auth.users(id,email_confirmed_at,is_anonymous) values($1,$2,$3)",
      [id, kind === "unverified" ? null : "2026-10-20T00:00:00Z", kind === "anonymous"]);
  }
  await db.query("insert into credit_ledger(user_id,delta,reason,stripe_session_id) values($1,100,'bought 100 credits','cs_test_paid')", [existing.paid]);
  await db.query("insert into credit_ledger(user_id,delta,reason) values($1,3,'manual gift')", [existing.bonus]);
  await starterMigration();
}, 30_000);
afterAll(() => db.close());

async function balance(id: string) {
  return (await db.query<{ balance: number }>("select coalesce(sum(delta),0)::int as balance from credit_ledger where user_id=$1", [id])).rows[0]!.balance;
}
async function signup(confirmed = true, anonymous = false) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users(id,email_confirmed_at,is_anonymous) values($1,$2,$3)",
    [id, confirmed ? "2026-10-21T00:00:00Z" : null, anonymous]);
  return id;
}

it("adds ten credits to existing free accounts without changing purchases or other gifts", async () => {
  expect(await balance(existing.free)).toBe(10);
  expect(await balance(existing.bonus)).toBe(13);
  expect(await balance(existing.paid)).toBe(100);
  expect(await balance(existing.unverified)).toBe(0);
  expect(await balance(existing.anonymous)).toBe(0);
});

it("grants new verified accounts ten credits through the restricted Auth role", async () => {
  await db.exec("set role supabase_auth_admin");
  let id: string;
  try { id = await signup(); } finally { await db.exec("reset role"); }
  expect(await balance(id!)).toBe(10);
});

it("waits for email confirmation and anonymous-account conversion", async () => {
  const unverified = await signup(false);
  const anonymous = await signup(true, true);
  expect(await balance(unverified)).toBe(0);
  expect(await balance(anonymous)).toBe(0);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [unverified]);
  await db.query("update auth.users set is_anonymous=false where id=$1", [anonymous]);
  expect(await balance(unverified)).toBe(10);
  expect(await balance(anonymous)).toBe(10);
});

it("never refills spent credits on repeated confirmation updates or migration replay", async () => {
  const id = await signup();
  await db.query("insert into credit_ledger(user_id,delta,reason) values($1,-10,'generation')", [id]);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [id]);
  await starterMigration();
  expect(await balance(id)).toBe(0);
  expect((await db.query("select id from credit_ledger where user_id=$1 and grant_key='starter'", [id])).rows).toHaveLength(1);
  await expect(db.query("insert into credit_ledger(user_id,delta,reason,grant_key) values($1,10,'duplicate','starter')", [id])).rejects.toThrow("duplicate key");
});

it("does not retroactively grant starter credits to a purchaser", async () => {
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [existing.paid]);
  expect(await balance(existing.paid)).toBe(100);
});

it("keeps purchased credits additive alongside the starter grant", async () => {
  const id = await signup();
  await db.query("insert into credit_ledger(user_id,delta,reason,stripe_session_id) values($1,100,'bought 100 credits',$2)", [id, `cs_test_${id}`]);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [id]);
  expect(await balance(id)).toBe(110);
});

it("ignores user-editable verification and credit claims", async () => {
  const id = await signup(false);
  await db.query(`update auth.users set raw_user_meta_data='{"email_verified":true,"credits":999,"is_anonymous":false}' where id=$1`, [id]);
  expect(await balance(id)).toBe(0);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [id]);
  expect(await balance(id)).toBe(10);
});

it("lets users read their balance but prevents minting or resetting grants", async () => {
  const id = await signup();
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
  try {
    expect(await balance(id)).toBe(10);
    expect(await balance(existing.free)).toBe(0);
    await expect(db.query("insert into credit_ledger(user_id,delta,reason,grant_key) values($1,10,'forged','starter')", [id])).rejects.toThrow(/permission denied|row-level security/);
    await expect(db.query("update credit_ledger set grant_key=null where user_id=$1", [id])).rejects.toThrow(/permission denied|row-level security/);
  } finally { await db.exec("reset role"); }
  const permissions = (await db.query(`select
    has_function_privilege('authenticated','private.grant_starter_credits()','execute') as user_execute,
    has_function_privilege('anon','private.grant_starter_credits()','execute') as anonymous_execute
  `)).rows[0];
  expect(permissions).toEqual({ user_execute: false, anonymous_execute: false });
});
