// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { DatabaseSync } from 'node:sqlite';
import type { DueCard } from '@schwanki/core';
import { ReviewStore, type Database, type Value } from './storage';
const harness = vi.hoisted(() => ({
  online: false,
  listener: undefined as undefined | ((state: { isConnected: boolean; isInternetReachable: boolean }) => void),
  store: undefined as unknown,
  listDueCards: vi.fn(), listSources: vi.fn(), countNewStarted: vi.fn(), saveReview: vi.fn(),
}));
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } }));
vi.mock('@react-native-community/netinfo', () => ({ default: { addEventListener(cb: typeof harness.listener) { harness.listener = cb; cb?.({ isConnected: harness.online, isInternetReachable: harness.online }); return () => { harness.listener = undefined; }; } } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('./nativeStore', () => ({ getStore: async () => harness.store }));
vi.mock('./backend', () => ({ requireAccount: async () => undefined, api: { listDueCards: harness.listDueCards, listSources: harness.listSources, countNewStarted: harness.countNewStarted, saveReview: harness.saveReview } }));
vi.mock('./media', () => ({ loadMedia: async () => ({}) }));
import { useLibrary } from './useLibrary';
let db: DatabaseSync; let store: ReviewStore;
const card = (id: string): DueCard => ({ card: { id, userId: 'user-a', sourceId: null, language: 'es', front: id, back: 'meaning', createdAt: '2026-10-29T00:00:00Z' }, state: null });
beforeEach(async () => {
  harness.online = false; vi.clearAllMocks();
  harness.listDueCards.mockResolvedValue([]); harness.listSources.mockResolvedValue([]); harness.countNewStarted.mockResolvedValue(0); harness.saveReview.mockResolvedValue(undefined);
  db = new DatabaseSync(':memory:');
  const adapter: Database = {
    async execAsync(sql) { db.exec(sql); }, async runAsync(sql, ...p: Value[]) { return db.prepare(sql).run(...p); },
    async getAllAsync<T>(sql: string, ...p: Value[]) { return db.prepare(sql).all(...p) as T[]; },
    async getFirstAsync<T>(sql: string, ...p: Value[]) { return db.prepare(sql).get(...p) as T ?? null; },
  };
  store = new ReviewStore(adapter); harness.store = store; await store.initialize();
  await store.mergeCards('user-a', [card('a'), card('b')]);
});
afterEach(async () => { cleanup(); await store.count('user-a'); db.close(); });
it('reviews and resumes offline through real SQLite without a server request', async () => {
  const first = renderHook(() => useLibrary('user-a'));
  await waitFor(() => expect(first.result.current.queue.map(d => d.card.id)).toEqual(['a','b']));
  await act(async () => { expect(await first.result.current.rate('good', 100)).toBe(true); });
  expect(await store.count('user-a')).toBe(1); expect(harness.saveReview).not.toHaveBeenCalled();
  first.unmount();
  const resumed = renderHook(() => useLibrary('user-a'));
  await waitFor(() => expect(resumed.result.current.queue.map(d => d.card.id)).toEqual(['b']));
  expect(harness.listDueCards).not.toHaveBeenCalled();
});
it('shows cached cards before a slow refresh and does not regress a rating when it completes', async () => {
  harness.online = true;
  let release!: (cards: DueCard[]) => void;
  harness.listDueCards.mockImplementation(() => new Promise<DueCard[]>(resolve => { release = resolve; }));
  const hook = renderHook(() => useLibrary('user-a'));
  await waitFor(() => expect(hook.result.current.queue[0]?.card.id).toBe('a'));
  await waitFor(() => expect(harness.listDueCards).toHaveBeenCalled());
  await act(async () => { await hook.result.current.rate('good', 100); });
  await act(async () => { release([card('a'),card('b')]); });
  await waitFor(() => expect(hook.result.current.refreshing).toBe(false));
  expect(hook.result.current.queue[0]?.card.id).toBe('b');
  expect((await store.cards('user-a')).find(d => d.card.id === 'a')?.state?.reps).toBe(1);
});
it('retains cached cards and pending reviews when sync needs authentication', async () => {
  const first = renderHook(() => useLibrary('user-a'));
  await waitFor(() => expect(first.result.current.queue).toHaveLength(2));
  await act(async () => { await first.result.current.rate('good', 100); });
  first.unmount(); harness.online = true; harness.saveReview.mockRejectedValue(new Error('Sign in again'));
  harness.listDueCards.mockRejectedValue(new Error('Sign in again'));
  const second = renderHook(() => useLibrary('user-a'));
  await waitFor(() => expect(second.result.current.syncError).toBe('Sign in again'));
  await waitFor(() => expect(second.result.current.refreshing).toBe(false));
  expect(await store.count('user-a')).toBe(1);
  expect(second.result.current.queue[0]?.card.id).toBe('b');
});
it('hides the previous account queue immediately when the signed-in account changes', async () => {
  const hook = renderHook(({ userId }) => useLibrary(userId), { initialProps: { userId: 'user-a' } });
  await waitFor(() => expect(hook.result.current.queue).toHaveLength(2));
  hook.rerender({ userId: 'user-b' });
  expect(hook.result.current.queue).toEqual([]);
  await act(async () => { expect(await hook.result.current.rate('good', 100)).toBe(false); });
  expect(await store.count('user-a')).toBe(0);
  expect(await store.count('user-b')).toBe(0);
});
