import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const db = new PGlite();
const user = "20000000-0000-0000-0000-000000000001";
const read = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");

beforeAll(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role bypassrls;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema cron; create function cron.schedule(text,text,text) returns int language sql as $$select 1$$;
    create function call_edge_function(text) returns void language sql as $$select$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
  `);
  await db.exec(read("0001_initial.sql").replace("create extension if not exists pgcrypto;", ""));
  await db.exec(read("0005_mnemonics.sql"));
  await db.exec(read("0008_bulk_jobs.sql"));
  await db.exec(read("20261020040639_anki_deck_sources.sql"));
  await db.exec(read("20261103060000_auto_generate.sql"));
  await db.query("insert into auth.users(id) values($1)", [user]);
}, 30_000);
afterAll(() => db.close());

beforeEach(async () => {
  await db.exec("delete from bulk_jobs; delete from cards; delete from sources; delete from credit_ledger; delete from user_api_keys; delete from auto_generate_settings;");
  await db.query("insert into credit_ledger(user_id,delta,reason) values($1,10,'starter')", [user]);
});

async function source(label: string, language = "zh", type = "google_doc") {
  const { rows } = await db.query<{ id: string }>(
    "insert into sources(user_id,type,external_ref,label,language) values($1,$2,'ref',$3,$4) returning id", [user, type, label, language]);
  return rows[0]!.id;
}
let n = 0;
async function card(sourceId: string | null, language = "zh") {
  n++;
  await db.query("insert into cards(user_id,source_id,language,front,back) values($1,$2,$3,$4,'x')", [user, sourceId, language, `word${n}`]);
}
async function settings(decks: string[], extra: { kinds?: string[]; daily_limit?: number } = {}) {
  await db.query("insert into auto_generate_settings(user_id,decks,kinds,daily_limit) values($1,$2,$3,$4)",
    [user, decks, extra.kinds ?? ["sentence", "image", "audio"], extra.daily_limit ?? 25]);
}
const jobs = async () => (await db.query<{ kinds: string[]; auto: boolean }>("select kinds, auto from bulk_jobs")).rows;

it("does nothing until the learner turns it on", async () => {
  await card(await source("Ms. Li · 2026-11-01"));
  expect(await jobs()).toEqual([]);
});

it("queues new words from a picked teacher, matching dated class labels case-insensitively", async () => {
  await settings(["ms. li|zh"], { kinds: ["sentence", "image"] });
  await card(await source("Ms. Li · 2026-11-01"));
  await card(await source("ms. li "));
  expect(await jobs()).toEqual([{ kinds: ["sentence", "image"], auto: true }, { kinds: ["sentence", "image"], auto: true }]);
});

it("skips other teachers, other languages, Anki imports and cards without a source", async () => {
  await settings(["ms. li|zh"]);
  await card(await source("Kru Somchai", "zh"));
  await card(await source("Ms. Li", "th"), "th");
  await card(await source("Ms. Li", "zh", "anki_deck"));
  await card(null);
  expect(await jobs()).toEqual([]);
});

it("covers every teacher in a language with *", async () => {
  await settings(["*|th"]);
  await card(await source("Kru Somchai", "th"), "th");
  await card(await source("Ms. Li", "zh"));
  expect(await jobs()).toHaveLength(1);
});

it("stops at the daily limit", async () => {
  await settings(["*|zh"], { daily_limit: 2 });
  const id = await source("Ms. Li");
  for (let i = 0; i < 4; i++) await card(id);
  expect(await jobs()).toHaveLength(2);
});

it("doesn't queue pictures or audio with no credits and no own keys", async () => {
  await settings(["*|zh"]);
  await db.query("insert into credit_ledger(user_id,delta,reason) values($1,-10,'spent')", [user]);
  const id = await source("Ms. Li");
  await card(id);
  expect(await jobs()).toHaveLength(0);
  await db.query("insert into user_api_keys(user_id,provider,api_key) values($1,'openai','k')", [user]);
  await card(id);
  expect(await jobs()).toHaveLength(1);
});

it("still queues sentences alone with no credits, since those have a free daily allowance", async () => {
  await settings(["*|zh"], { kinds: ["sentence"] });
  await db.query("insert into credit_ledger(user_id,delta,reason) values($1,-10,'spent')", [user]);
  await card(await source("Ms. Li"));
  expect(await jobs()).toHaveLength(1);
});
