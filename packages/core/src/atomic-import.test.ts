import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
const db = new PGlite();
const owner = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
let source: string;
beforeAll(async () => {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;`);
  const read = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8');
  await db.exec(read('0001_initial.sql').replace('create extension if not exists pgcrypto;', ''));
  await db.exec(read('20261020040639_anki_deck_sources.sql'));
  await db.exec(`alter table cards add column kind text not null default 'vocabulary';
    grant select,insert on sources,cards,card_state,review_events to authenticated;
    insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(read('20261029100000_atomic_anki_import.sql'));
}, 30000);
beforeEach(async () => {
  source = (await db.query<{ id: string }>(`insert into sources(user_id,type,external_ref,label,language) values($1,'anki_deck',$2,'Spanish','es') returning id`, [owner, crypto.randomUUID()])).rows[0]!.id;
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
});
afterEach(() => db.exec('reset role'));
afterAll(() => db.close());
const item = () => ({ front: crypto.randomUUID(), back: 'meaning', state: { dueAt: '2026-11-01T00:00:00Z', stability: 1, difficulty: 5, reps: 1, lapses: 0, fsrs: { reps: 1 }, lastReviewedAt: '2026-10-28T00:00:00Z' }, reviews: [{ reviewedAt: '2026-10-28T00:00:00Z', rating: 'good', fsrsStateBefore: { state: 0 } }] });
async function save(items: unknown[], id = source) {
  return (await db.query<{ result: Array<{ id: string; created: boolean; ownsMedia: boolean }> }>('select public.import_anki_batch($1,$2::jsonb) result', [id, JSON.stringify(items)])).rows[0]!.result;
}
it('commits card, schedule and history together and returns stable ids on redelivery', async () => {
  const input = item(); const first = await save([input]);
  expect(first[0]).toMatchObject({ created: true, ownsMedia: true });
  const second = await save([{ ...input, state: { ...input.state, reps: 900 } }]);
  expect(second[0]).toEqual({ ...first[0], created: false });
  expect((await db.query('select reps from card_state where card_id=$1', [first[0]!.id])).rows).toEqual([{ reps: 1 }]);
  expect((await db.query('select id from review_events where card_id=$1', [first[0]!.id])).rows).toHaveLength(1);
});
it('rolls back the entire batch when a later schedule is invalid', async () => {
  const first = item(); const invalid = item();
  await expect(save([first, { ...invalid, state: { ...invalid.state, fsrs: null } }])).rejects.toThrow();
  expect((await db.query('select id from cards where source_id=$1', [source])).rows).toHaveLength(0);
  expect((await save([first]))[0]!.created).toBe(true);
});
it('does not authorize media replacement on duplicates from another source', async () => {
  const input = item(); const first = await save([input]);
  const another = (await db.query<{ id: string }>(`insert into sources(user_id,type,external_ref,label,language) values($1,'anki_deck','other','Other','es') returning id`, [owner])).rows[0]!.id;
  expect((await save([input], another))[0]).toEqual({ id: first[0]!.id, created: false, ownsMedia: false });
});
it('rejects another account and anonymous callers without writes', async () => {
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
  await expect(save([item()])).rejects.toThrow('Anki source not found');
  await db.exec('set role anon'); await expect(save([item()])).rejects.toThrow('permission denied');
});
it('bounds batch size and rejects empty notes', async () => {
  await expect(save(Array.from({ length: 101 }, item))).rejects.toThrow('100');
  await expect(save([{ ...item(), front: '  ' }])).rejects.toThrow('word and meaning');
});
