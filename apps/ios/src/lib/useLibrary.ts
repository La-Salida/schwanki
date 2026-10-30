import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { applyReview, buildSessionQueue, capNewCards, type DueCard, type Source, type ReviewRating } from '@schwanki/core';
import { api, requireAccount } from './backend';
import { getStore } from './nativeStore';
import { ReviewSync, studyDayStart } from './sync';
import { loadMedia } from './media';
import type { ReviewStore } from './storage';

export function useLibrary(userId: string | null) {
  const [cacheOwner, setCacheOwner] = useState(userId);
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [caughtUp, setCaughtUp] = useState(false);
  const [limit, setLimit] = useState(20);
  const [appearance, setAppearance] = useState(0);
  const alive = useRef(true);
  const busy = useRef<string | null>(null);
  const version = useRef(0);
  const queuedRefresh = useRef(false);
  const queueRef = useRef(queue); queueRef.current = queue;
  const saving = useRef(false);
  const onlineRef = useRef(true);
  const userRef = useRef(userId); userRef.current = userId;
  const sync = useRef<{ userId: string; runner: ReviewSync } | null>(null);
  const flush = useCallback(async () => {
    if (!userId || !onlineRef.current) return;
    try {
      const store = await getStore();
      if (sync.current?.userId !== userId) sync.current = { userId, runner: new ReviewSync(store, userId, {
        async saveReview(state, event) { await requireAccount(userId); await api.saveReview(state, event); },
      }) };
      await sync.current.runner.flush(); if (alive.current && userRef.current === userId) setSyncError(null); }
    catch (failure) { if (alive.current && userRef.current === userId) setSyncError(message(failure)); }
    if (alive.current && userRef.current === userId) setPending(await (await getStore()).count(userId));
  }, [userId]);
  const refresh = useCallback(async (resetSession = false) => {
    if (!userId) return;
    if (busy.current === userId) { if (resetSession) queuedRefresh.current = true; return; }
    busy.current = userId;
    const startVersion = version.current;
    const current = () => alive.current && userRef.current === userId;
    if (current()) setRefreshing(true);
    try {
      const store = await getStore();
      const scope = await store.get<string>(userId, 'deck');
      const newLimit = await store.get<number>(userId, 'newLimit') ?? 20;
      let cached = await store.cards(userId);
      const cachedSources = await store.get<Source[]>(userId, 'sources') ?? [];
      const early = await cachedQueue(store, userId, cached, scope, newLimit, resetSession);
      if (current() && version.current === startVersion) {
        setCards(cached); setSources(cachedSources); setLimit(newLimit); setFilter(scope);
        if (cached.length || !onlineRef.current) {
          if (!queueRef.current.length || resetSession) { queueRef.current = early.next; setQueue(early.next); }
          setLoaded(true);
          if (!early.prior) await store.set(userId, 'session', { filter: scope, ids: early.next.map(d => d.card.id) });
        }
      }
      let fresh = false;
      if (onlineRef.current) {
        await flush();
        try {
          await requireAccount(userId);
          const now = new Date();
          const remote = await api.listDueCards(now, 500, scope);
          await store.mergeCards(userId, remote, remote.length < 500, now.toISOString(), scope);
          cached = await store.cards(userId);
          fresh = remote.length < 500; // A capped response is never proof the entire queue is exhausted.
          const metadata = await api.listSources();
          await store.set(userId, 'sources', metadata);
          if (current()) setSources(metadata);
          if (await store.count(userId) === 0) {
            const day = studyDayStart().toISOString();
            const base = await store.get<{ day: string; n: number }>(userId, 'newStarted');
            const n = await api.countNewStarted(new Date(day));
            await store.reconcileNewStarted(userId, day, n, base?.day === day ? base.n : 0);
          }
          if (current()) setError(null);
        } catch (failure) { if (current()) setError(message(failure)); }
      }
      const { next: planned, prior } = await cachedQueue(store, userId, cached, scope, newLimit, resetSession);
      // Keep the visible word under the learner's thumb through a background refresh.
      const visible = queueRef.current[0];
      const next = visible && (!scope || visible.card.sourceId === scope) && !resetSession && planned[0]?.card.id !== visible.card.id
        ? [cached.find(d => d.card.id === visible.card.id) ?? visible, ...planned.filter(d => d.card.id !== visible.card.id)] : planned;
      if (current()) {
        setLoaded(true);
        if (version.current === startVersion) {
          setCards(cached); setQueue(next); setCaughtUp(fresh && next.length === 0);
          if (!prior || resetSession) await store.set(userId, 'session', { filter: scope, ids: next.map(d => d.card.id) });
        }
        setPending(await store.count(userId));
      }
      // Download the active batch gradually; text is already usable even if this fails.
      if (onlineRef.current) void (async () => {
        const ids = next.map(d => d.card.id);
        for (let i = 0; i < ids.length && current() && onlineRef.current; i += 2) {
          await Promise.allSettled(ids.slice(i, i + 2).map(id => loadMedia(userId, id, true, ids)));
        }
      })();
    } catch (failure) { if (current()) { setError(message(failure)); setLoaded(true); } }
    finally {
      if (busy.current === userId) busy.current = null;
      if (current()) {
        setRefreshing(false);
        if (queuedRefresh.current) { queuedRefresh.current = false; void refresh(true); }
      }
    }
  }, [userId, flush]);
  useEffect(() => {
    alive.current = true;
    setCacheOwner(userId); setQueue([]); setCards([]); setSources([]); setLoaded(!userId); setError(null); setSyncError(null); setPending(0); setCaughtUp(false);
    if (userId) void refresh();
    return () => { alive.current = false; };
  }, [userId, refresh]);
  useEffect(() => {
    const stop = NetInfo.addEventListener(state => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasOffline = !onlineRef.current; onlineRef.current = connected; setOnline(connected);
      if (connected && wasOffline) void refresh();
    });
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 60_000);
    return () => { stop(); app.remove(); clearInterval(timer); };
  }, [refresh]);
  async function rate(rating: ReviewRating, elapsedMs: number) {
    if (!userId || saving.current || !queue[0] || queueRef.current[0]?.card.id !== queue[0].card.id || queue[0].card.userId !== userId || cacheOwner !== userId) return false;
    saving.current = true;
    const card = queue[0];
    try {
      const { event, state } = applyReview(card, rating, new Date());
      const next = rating === 'again' ? [...queue.slice(1), { card: card.card, state }] : queue.slice(1);
      const store = await getStore();
      await store.queue(userId, card, { state, event: { ...event, id: Crypto.randomUUID(), elapsedMs } }, { filter, ids: next.map(d => d.card.id) });
      if (userRef.current !== userId) return false;
      version.current++;
      setQueue(next); setAppearance(n => n + 1); setCaughtUp(false);
      setCards(previous => previous.map(d => d.card.id === card.card.id ? { card: d.card, state } : d));
      setPending(await store.count(userId));
      void flush();
      if (next.length === 0) void refresh(true);
      return true;
    } finally { saving.current = false; }
  }
  async function selectDeck(sourceId: string | null) {
    if (!userId) return;
    const selectedVersion = ++version.current;
    // The sheet closes before storage/network finish. No old-deck card may remain rateable.
    queueRef.current = []; setQueue([]); setFilter(sourceId); setCaughtUp(false);
    const store = await getStore(); await store.set(userId, 'deck', sourceId); await store.set(userId, 'session', null);
    if (userRef.current === userId && version.current === selectedVersion) await refresh(true);
  }
  const owned = cacheOwner === userId;
  return { queue: owned ? queue : [], cards: owned ? cards : [], sources: owned ? sources : [], filter: owned ? filter : null, online, loaded: owned && loaded, refreshing, error, syncError, pending: owned ? pending : 0, caughtUp: owned && caughtUp, limit, appearance, refresh, flush, rate, selectDeck };
}
export function message(error: unknown) { return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Could not finish that request. Try again.'; }

async function cachedQueue(store: ReviewStore, userId: string, cached: DueCard[], scope: string | null, newLimit: number, resetSession: boolean) {
  const today = studyDayStart().toISOString();
  const started = await store.startedNew(userId, today);
  const available = capNewCards(cached.filter(d => (!scope || d.card.sourceId === scope) && (!d.state || Date.parse(d.state.dueAt) <= Date.now())), Math.max(0, newLimit - started));
  const prior = resetSession ? null : await store.get<{ filter: string | null; ids: string[] }>(userId, 'session');
  const restored = prior?.filter === scope ? prior.ids.flatMap(id => { const item = cached.find(d => d.card.id === id && (!scope || d.card.sourceId === scope)); return item ? [item] : []; }) : [];
  return { prior, next: restored.length ? restored : buildSessionQueue(available, new Date()) };
}
