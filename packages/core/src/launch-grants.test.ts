import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const uid = "10000000-0000-0000-0000-000000000001";
const other = "10000000-0000-0000-0000-000000000002";
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");

beforeAll(async () => {
  await db.exec(`
    create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role bypassrls;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
  `);
  await db.exec(migration("0001_initial.sql").replace("create extension if not exists pgcrypto;", ""));
  await db.exec(migration("0005_mnemonics.sql"));
  await db.exec(migration("20261021063605_core_api_grants.sql"));
  await db.exec(`insert into auth.users values ('${uid}'),('${other}');`);
}, 30_000);
afterAll(() => db.close());

it("lets a signed-in user import cards and schedules while retaining ownership RLS", async () => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  try {
    const source = (await db.query<{ id: string }>(`insert into sources(user_id,type,external_ref,label,language) values($1,'manual','launch','Launch','en') returning id`, [uid])).rows[0]!.id;
    const card = (await db.query<{ id: string }>(`insert into cards(user_id,source_id,language,front,back) values($1,$2,'en','hello','world') returning id`, [uid, source])).rows[0]!.id;
    await db.query(`insert into card_state(card_id,user_id,due_at,fsrs) values($1,$2,now(),'{}')`, [card, uid]);
    await expect(db.query(`insert into sources(user_id,type,external_ref,label,language) values($1,'manual','foreign','Foreign','en')`, [other])).rejects.toThrow("row-level security");
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
    expect((await db.query("select id from sources")).rows).toEqual([]);
    expect((await db.query("select id from cards")).rows).toEqual([]);
  } finally { await db.exec("reset role"); }
});

it("keeps credit grants service-only and leaves anonymous users without table access", async () => {
  const grants = (await db.query<{ anon: boolean; user_read: boolean; user_write: boolean; service_write: boolean }>(`
    select has_table_privilege('anon','sources','INSERT') as anon,
      has_table_privilege('authenticated','credit_ledger','SELECT') as user_read,
      has_table_privilege('authenticated','credit_ledger','INSERT') as user_write,
      has_table_privilege('service_role','credit_ledger','INSERT') as service_write
  `)).rows[0];
  expect(grants).toEqual({ anon: false, user_read: true, user_write: false, service_write: true });
});
