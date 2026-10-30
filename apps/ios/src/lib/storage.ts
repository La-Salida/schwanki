import type { CardState, DueCard, ReviewRating, SerializedFsrsCard } from '@schwanki/core';
import { studyDayStart } from './sync';

export type Value = string | number | null;
/** Kept independent of Expo so the real SQLite transaction behavior is testable in Node. */
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Value[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: Value[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: Value[]): Promise<T | null>;
}
export interface ReviewPayload {
  state: CardState;
  event: { id: string; cardId: string; reviewedAt: string; rating: ReviewRating; fsrsStateBefore: SerializedFsrsCard; elapsedMs: number };
}
export interface PendingReview { seq: number; payload: ReviewPayload }
export interface CachedMedia { image?: string; audio?: string; sentence?: string; translation?: string }
const schema = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS cards(user_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(user_id,id));
  CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,event_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS outbox_account ON outbox(user_id,seq);
  CREATE TABLE IF NOT EXISTS settings(user_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(user_id,key));
  CREATE TABLE IF NOT EXISTS media(user_id TEXT NOT NULL,card_id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(user_id,card_id));
`;

export class ReviewStore {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private db: Database) {}
  async initialize() { await this.db.execAsync(schema); }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.tail.then(fn);
    this.tail = task.catch(() => undefined);
    return task;
  }
  private transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.serial(async () => {
      await this.db.execAsync('BEGIN IMMEDIATE');
      try { const result = await fn(); await this.db.execAsync('COMMIT'); return result; }
      catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
  cards(userId: string): Promise<DueCard[]> {
    return this.serial(async () => (await this.db.getAllAsync<{ payload: string }>('SELECT payload FROM cards WHERE user_id=?', userId)).map(r => JSON.parse(r.payload)));
  }
  /** A remote refresh may race uploads. Never overwrite newer local schedules or pending ratings. */
  mergeCards(userId: string, remote: DueCard[], complete = false, now = new Date().toISOString(), sourceId: string | null = null) {
    return this.transaction(async () => {
      const locals = new Map((await this.db.getAllAsync<{ id: string; payload: string }>('SELECT id,payload FROM cards WHERE user_id=?', userId)).map(r => [r.id, JSON.parse(r.payload) as DueCard]));
      const pending = new Set((await this.db.getAllAsync<{ payload: string }>('SELECT payload FROM outbox WHERE user_id=?', userId)).map(r => (JSON.parse(r.payload) as ReviewPayload).event.cardId));
      const received = new Set(remote.map(d => d.card.id));
      if (complete) for (const [id, local] of locals) {
        if ((!sourceId || local.card.sourceId === sourceId) && !received.has(id) && !pending.has(id) && (!local.state || Date.parse(local.state.dueAt) <= Date.parse(now))) {
          await this.db.runAsync('DELETE FROM cards WHERE user_id=? AND id=?', userId, id);
        }
      }
      for (const card of remote) {
        if (card.card.userId !== userId) throw new Error('Card account mismatch');
        const local = locals.get(card.card.id);
        const newer = local?.state?.lastReviewedAt && (!card.state?.lastReviewedAt || Date.parse(local.state.lastReviewedAt) > Date.parse(card.state.lastReviewedAt));
        const merged = local && (pending.has(card.card.id) || newer) ? { card: card.card, state: local.state } : card;
        await this.db.runAsync('INSERT OR REPLACE INTO cards VALUES(?,?,?)', userId, card.card.id, JSON.stringify(merged));
      }
    });
  }
  queue(userId: string, current: DueCard, payload: ReviewPayload, session?: { filter: string | null; ids: string[] }) {
    if (current.card.userId !== userId || current.card.id !== payload.event.cardId || payload.state.cardId !== current.card.id) return Promise.reject(new Error('Review account or card mismatch'));
    return this.transaction(async () => {
      const duplicate = await this.db.getFirstAsync('SELECT seq FROM outbox WHERE event_id=?', payload.event.id);
      if (duplicate) return;
      await this.db.runAsync('INSERT INTO outbox(user_id,event_id,payload) VALUES(?,?,?)', userId, payload.event.id, JSON.stringify(payload));
      await this.db.runAsync('INSERT OR REPLACE INTO cards VALUES(?,?,?)', userId, current.card.id, JSON.stringify({ card: current.card, state: payload.state }));
      if (session) await this.db.runAsync('INSERT OR REPLACE INTO settings VALUES(?,?,?)', userId, 'session', JSON.stringify(session));
    });
  }
  head(userId: string): Promise<PendingReview | null> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ seq: number; payload: string }>('SELECT seq,payload FROM outbox WHERE user_id=? ORDER BY seq LIMIT 1', userId);
      return row ? { seq: row.seq, payload: JSON.parse(row.payload) } : null;
    });
  }
  acknowledge(userId: string, seq: number) {
    return this.transaction(async () => {
      const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM outbox WHERE user_id=? AND seq=?', userId, seq);
      if (!row) return;
      const { event } = JSON.parse(row.payload) as ReviewPayload;
      if (event.fsrsStateBefore.state === 0) {
        const day = studyDayStart(new Date(event.reviewedAt)).toISOString();
        const saved = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE user_id=? AND key=?', userId, 'newStarted');
        const base = saved ? JSON.parse(saved.value) as { day: string; n: number } : null;
        if (!base || base.day <= day) {
          await this.db.runAsync('INSERT OR REPLACE INTO settings VALUES(?,?,?)', userId, 'newStarted', JSON.stringify({ day, n: (base?.day === day ? base.n : 0) + 1 }));
        }
      }
      await this.db.runAsync('DELETE FROM outbox WHERE user_id=? AND seq=?', userId, seq);
    });
  }
  /** Preserve uploads acknowledged while the server count was in flight. */
  reconcileNewStarted(userId: string, day: string, remote: number, before: number) {
    return this.transaction(async () => {
      const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE user_id=? AND key=?', userId, 'newStarted');
      const base = row ? JSON.parse(row.value) as { day: string; n: number } : null;
      const acknowledged = base?.day === day ? Math.max(0, base.n - before) : 0;
      if (!base || base.day <= day) await this.db.runAsync('INSERT OR REPLACE INTO settings VALUES(?,?,?)', userId, 'newStarted', JSON.stringify({ day, n: remote + acknowledged }));
    });
  }
  discardDeletedCard(userId: string, cardId: string) {
    return this.transaction(async () => {
      const pending = await this.db.getAllAsync<{ seq: number; payload: string }>('SELECT seq,payload FROM outbox WHERE user_id=?', userId);
      for (const row of pending) if ((JSON.parse(row.payload) as ReviewPayload).event.cardId === cardId) await this.db.runAsync('DELETE FROM outbox WHERE user_id=? AND seq=?', userId, row.seq);
      await this.db.runAsync('DELETE FROM cards WHERE user_id=? AND id=?', userId, cardId);
      await this.db.runAsync('DELETE FROM media WHERE user_id=? AND card_id=?', userId, cardId);
    });
  }
  count(userId: string): Promise<number> { return this.serial(async () => (await this.db.getFirstAsync<{ n: number }>('SELECT count(*) as n FROM outbox WHERE user_id=?', userId))?.n ?? 0); }
  /** Read both sides of an acknowledgement without letting one run between them. */
  startedNew(userId: string, day: string): Promise<number> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE user_id=? AND key=?', userId, 'newStarted');
      const base = row ? JSON.parse(row.value) as { day: string; n: number } : null;
      return (base?.day === day ? base.n : 0) + await this.pendingNewCount(userId, day);
    });
  }
  pendingNew(userId: string, since: string): Promise<number> {
    return this.serial(() => this.pendingNewCount(userId, since));
  }
  private async pendingNewCount(userId: string, since: string): Promise<number> {
    return (await this.db.getAllAsync<{ payload: string }>('SELECT payload FROM outbox WHERE user_id=?', userId)).filter(row => {
      const event = (JSON.parse(row.payload) as ReviewPayload).event;
      return event.reviewedAt >= since && event.fsrsStateBefore.state === 0;
    }).length;
  }
  get<T>(userId: string, key: string): Promise<T | null> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE user_id=? AND key=?', userId, key);
      return row ? JSON.parse(row.value) : null;
    });
  }
  set(userId: string, key: string, value: unknown) { return this.serial(() => this.db.runAsync('INSERT OR REPLACE INTO settings VALUES(?,?,?)', userId, key, JSON.stringify(value))); }
  media(userId: string, cardId: string): Promise<CachedMedia> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM media WHERE user_id=? AND card_id=?', userId, cardId);
      return row ? JSON.parse(row.payload) : {};
    });
  }
  setMedia(userId: string, cardId: string, media: CachedMedia) { return this.serial(() => this.db.runAsync('INSERT OR REPLACE INTO media VALUES(?,?,?)', userId, cardId, JSON.stringify(media))); }
  clearAccount(userId: string, deleted = false) {
    return this.transaction(async () => {
      const pending = await this.db.getFirstAsync<{ n: number }>('SELECT count(*) as n FROM outbox WHERE user_id=?', userId);
      if (pending?.n && !deleted) throw new Error('Connect to sync your offline reviews before signing out.');
      for (const table of ['cards', 'media', 'settings', 'outbox']) await this.db.runAsync(`DELETE FROM ${table} WHERE user_id=?`, userId);
    });
  }
}
