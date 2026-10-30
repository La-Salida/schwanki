import { afterEach, beforeEach, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initCardState, applyReview, type DueCard } from '@schwanki/core';
import { ReviewStore, type Database, type Value } from './storage';
import { ReviewSync, gestureAction, studyDayStart } from './sync';
let db: DatabaseSync; let store: ReviewStore; let directory: string; let file: string;
function open() {
  db = new DatabaseSync(file);
  const adapter: Database = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, ...params: Value[]) { return db.prepare(sql).run(...params); },
    async getAllAsync<T>(sql: string, ...params: Value[]) { return db.prepare(sql).all(...params) as T[]; },
    async getFirstAsync<T>(sql: string, ...params: Value[]) { return (db.prepare(sql).get(...params) as T | undefined) ?? null; },
  };
  store = new ReviewStore(adapter);
  return store.initialize();
}
function card(id = 'card-a', userId = 'user-a'): DueCard { return { card: { id, userId, sourceId: null, front: 'siesta', back: 'nap', language: 'es', createdAt: '2026-10-29T00:00:00Z' }, state: null }; }
function payload(d = card(), at = '2026-10-29T10:00:00Z') { const r = applyReview(d, 'good', new Date(at)); return { ...r, event: { ...r.event, id: crypto.randomUUID(), elapsedMs: 100 } }; }
beforeEach(async () => { directory = mkdtempSync(join(tmpdir(), 'schwanki-ios-')); file = join(directory, 'test.db'); await open(); });
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });
it('restores the same event, updated schedule and next card after a process restart', async () => {
  const d = card(); const review = payload(d);
  await store.queue('user-a', d, review, { filter: null, ids: ['card-b'] });
  db.close(); await open();
  expect((await store.head('user-a'))?.payload.event.id).toBe(review.event.id);
  expect((await store.cards('user-a'))[0]?.state).toEqual(review.state);
  expect(await store.get('user-a', 'session')).toEqual({ filter: null, ids: ['card-b'] });
});
it('rolls back the outbox when persisting the schedule fails', async () => {
  db.exec("CREATE TRIGGER fail_card BEFORE INSERT ON cards BEGIN SELECT RAISE(ABORT,'disk full'); END;");
  await expect(store.queue('user-a', card(), payload())).rejects.toThrow('disk full');
  expect(await store.count('user-a')).toBe(0); expect(await store.cards('user-a')).toEqual([]);
});
it('does not duplicate a local event or replace its schedule when retried', async () => {
  const review = payload(); await store.queue('user-a', card(), review);
  await store.queue('user-a', card(), { ...review, state: { ...review.state, reps: 900 } });
  expect(await store.count('user-a')).toBe(1);
  expect((await store.cards('user-a'))[0]?.state?.reps).toBe(review.state.reps);
});
it('preserves newer local schedules before and after upload acknowledgements', async () => {
  const review = payload(); await store.queue('user-a', card(), review);
  await store.mergeCards('user-a', [card()]);
  await store.acknowledge('user-a', (await store.head('user-a'))!.seq);
  await store.mergeCards('user-a', [card()]);
  expect((await store.cards('user-a'))[0]?.state).toEqual(review.state);
});
it('removes remotely no-longer-due stale cards only after an uncapped refresh, preserving pending cards', async () => {
  await store.mergeCards('user-a', [card(), card('card-b')]);
  await store.queue('user-a', card(), payload());
  await store.mergeCards('user-a', [], false); expect(await store.cards('user-a')).toHaveLength(2);
  await store.mergeCards('user-a', [], true);
  expect((await store.cards('user-a')).map(d => d.card.id)).toEqual(['card-a']);
});
it('prunes a completed deck refresh without deleting another deck’s offline cards', async () => {
  const a = card(); a.card.sourceId = 'deck-a';
  const b = card('card-b'); b.card.sourceId = 'deck-b';
  await store.mergeCards('user-a', [a, b]);
  await store.mergeCards('user-a', [], true, new Date().toISOString(), 'deck-a');
  expect((await store.cards('user-a')).map(d => d.card.id)).toEqual(['card-b']);
});
it('keeps acknowledged new-card starts in the daily allowance after restart, without counting an acknowledgement twice', async () => {
  const day = studyDayStart().toISOString();
  await store.set('user-a', 'newStarted', { day, n: 3 });
  await store.queue('user-a', card(), payload(card(), new Date().toISOString()));
  const seq = (await store.head('user-a'))!.seq;
  await store.acknowledge('user-b', seq);
  await store.acknowledge('user-a', seq);
  await store.acknowledge('user-a', seq);
  db.close(); await open();
  expect(await store.get('user-a', 'newStarted')).toEqual({ day, n: 4 });
  expect(await store.pendingNew('user-a', day)).toBe(0);
});
it('does not charge an earlier study day’s uploads against today’s allowance', async () => {
  const day = studyDayStart().toISOString();
  await store.set('user-a', 'newStarted', { day, n: 3 });
  const yesterday = new Date(Date.parse(day) - 1).toISOString();
  await store.queue('user-a', card(), payload(card(), yesterday));
  await store.acknowledge('user-a', (await store.head('user-a'))!.seq);
  expect(await store.get('user-a', 'newStarted')).toEqual({ day, n: 3 });
});
it('reconciles a successful remote count without forgetting uploads acknowledged during the request', async () => {
  const day = studyDayStart().toISOString();
  await store.set('user-a', 'newStarted', { day, n: 3 });
  await store.queue('user-a', card(), payload(card(), new Date().toISOString()));
  await store.acknowledge('user-a', (await store.head('user-a'))!.seq);
  await store.reconcileNewStarted('user-a', day, 3, 3);
  expect(await store.get('user-a', 'newStarted')).toEqual({ day, n: 4 });
  await store.reconcileNewStarted('user-a', day, 4, 4);
  expect(await store.get('user-a', 'newStarted')).toEqual({ day, n: 4 });
});
it('isolates accounts and blocks sign-out cleanup while ratings are unsynced', async () => {
  await store.queue('user-a', card(), payload());
  expect(await store.cards('user-b')).toEqual([]); expect(await store.count('user-b')).toBe(0);
  await expect(store.queue('user-b', card(), payload())).rejects.toThrow('mismatch');
  await expect(store.clearAccount('user-a')).rejects.toThrow('sync');
  expect(await store.count('user-a')).toBe(1);
});
it('reuses a stable event id when the server commits but the acknowledgement is lost', async () => {
  const review = payload(); await store.queue('user-a', card(), review);
  const remote = new Set<string>(); let fail = true;
  const runner = new ReviewSync(store, 'user-a', { async saveReview(_state, event) { remote.add(event.id); if (fail) { fail = false; throw new Error('response lost'); } } });
  await expect(runner.flush()).rejects.toThrow('response lost');
  expect(await store.count('user-a')).toBe(1);
  await runner.flush(); expect(remote.size).toBe(1); expect(await store.count('user-a')).toBe(0);
});
it('serializes concurrent flushes and drains ratings added during an upload', async () => {
  await store.queue('user-a', card(), payload());
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const sent: string[] = [];
  const runner = new ReviewSync(store, 'user-a', { async saveReview(_state, event) { sent.push(event.cardId); await gate; } });
  const first = runner.flush();
  await store.queue('user-a', card('card-b'), payload(card('card-b')));
  const second = runner.flush(); release(); await Promise.all([first, second]);
  expect(sent).toEqual(['card-a', 'card-b']); expect(await store.count('user-a')).toBe(0);
});
it('keeps later reviews moving when an account-owned card was deleted remotely', async () => {
  await store.queue('user-a', card(), payload()); await store.queue('user-a', card('card-b'), payload(card('card-b')));
  const runner = new ReviewSync(store, 'user-a', { async saveReview(_state, event) { if (event.cardId === 'card-a') throw { code: '23503', message: 'card_state_card_id_fkey' }; } });
  await runner.flush(); expect(await store.count('user-a')).toBe(0); expect((await store.cards('user-a')).map(d => d.card.id)).toEqual(['card-b']);
});
it('keeps local writes and outbox records on authentication failure', async () => {
  await store.queue('user-a', card(), payload());
  const runner = new ReviewSync(store, 'user-a', { async saveReview() { throw new Error('expired'); } });
  await expect(runner.flush()).rejects.toThrow('expired'); expect(await store.count('user-a')).toBe(1);
});
it('reveals without rating, ignores short gestures, and preserves all shown-card shortcuts', () => {
  expect(gestureAction(0, -100, false)).toBe('reveal'); expect(gestureAction(-100, 0, false)).toBeNull();
  expect(gestureAction(10, -10, true)).toBeNull(); expect(gestureAction(0, -100, true)).toBe('good');
  expect(gestureAction(-100, 0, true)).toBe('again'); expect(gestureAction(100, 0, true)).toBe('easy');
});
it('starts a study day at 4am local, including late night across a month boundary', () => {
  expect(studyDayStart(new Date(2026, 10, 1, 3, 59))).toEqual(new Date(2026, 9, 31, 4));
  expect(studyDayStart(new Date(2026, 10, 1, 4))).toEqual(new Date(2026, 10, 1, 4));
});
