import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const db = new PGlite();
const owner = "10000000-0000-0000-0000-000000000001";
const other = "10000000-0000-0000-0000-000000000002";
let cardId: string;
const read = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
beforeAll(async () => {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  await db.exec(read("0001_initial.sql").replace("create extension if not exists pgcrypto;", ""));
  await db.exec(read("0005_mnemonics.sql"));
  await db.exec(`grant select,insert,update,delete on cards,card_media to authenticated;
    insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(read("20261021103643_editable_card_example.sql"));
  await db.exec(read("20261021103643_editable_card_example.sql"));
}, 30_000);
beforeEach(async () => {
  cardId = (await db.query<{ id: string }>(`insert into cards(user_id,language,front,back,example_sentence) values($1,'zh',$2,'abs','原文 obvious') returning id`, [owner, crypto.randomUUID()])).rows[0]!.id;
  for (const kind of ["sentence", "image", "audio"]) await db.query(`insert into card_media(card_id,user_id,generation_id,kind,content) values($1,$2,$3,$4,$5)`, [cardId, owner, crypto.randomUUID(), kind, kind === "sentence" ? JSON.stringify({ text: "旧句子。", translation: "Old sentence." }) : null]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
});
afterEach(() => db.exec("reset role"));
afterAll(() => db.close());
const save = (text: string, translation = "The cat has abs.") => db.query("select public.save_card_example($1,$2,$3)", [cardId, text, translation]);
const rows = async () => (await db.query<{ kind: string; content: string }>("select kind,content from card_media where card_id=$1 order by kind", [cardId])).rows;

it("replaces the review example, clears stale media, and preserves the original card", async () => {
  await save(" 猫有腹肌。 ");
  const media = await rows();
  expect(media).toHaveLength(1);
  expect(JSON.parse(media[0]!.content)).toEqual({ text: "猫有腹肌。", translation: "The cat has abs." });
  expect((await db.query("select example_sentence from cards where id=$1", [cardId])).rows[0]).toEqual({ example_sentence: "原文 obvious" });
});
it("retains image and audio for a translation-only edit", async () => {
  await db.query("update card_media set prompt_used='old association' where card_id=$1 and kind='sentence'", [cardId]);
  await save("旧句子。", "Corrected translation.");
  expect((await rows()).map(row => row.kind)).toEqual(["audio", "image", "sentence"]);
  expect((await db.query("select provider,prompt_used from card_media where card_id=$1 and kind='sentence'", [cardId])).rows[0])
    .toEqual({ provider: "manual", prompt_used: null });
});
it("can clear the review example and can safely repeat the same save", async () => {
  await save(""); await save("");
  expect(await rows()).toHaveLength(0);
  await save("猫有腹肌。"); await save("猫有腹肌。");
  expect(await rows()).toHaveLength(1);
});
it("rejects another account and anonymous execution", async () => {
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
  await expect(save("forged")).rejects.toThrow("card not found");
  await db.exec("reset role");
  expect((await db.query("select has_function_privilege('anon','public.save_card_example(uuid,text,text)','execute') as allowed")).rows[0]).toEqual({ allowed: false });
});
it("rolls back dependency removal if persisting the sentence fails", async () => {
  await db.exec(`reset role;
    create function public.reject_test_example() returns trigger language plpgsql as $$begin raise exception 'test failure'; end$$;
    create trigger reject_test_example before insert or update on card_media for each row when(new.kind='sentence') execute function public.reject_test_example();
    set role authenticated;`);
  try {
    await expect(save("猫有腹肌。")).rejects.toThrow("test failure");
    expect((await rows()).map(row => row.kind)).toEqual(["audio", "image", "sentence"]);
    expect(JSON.parse((await rows()).find(row => row.kind === "sentence")!.content).text).toBe("旧句子。");
  } finally { await db.exec("reset role; drop trigger reject_test_example on card_media; drop function public.reject_test_example();"); }
});
it("rejects oversized edits before touching media", async () => {
  await expect(save("a".repeat(10001))).rejects.toThrow("too long");
  expect(await rows()).toHaveLength(3);
});
