# Schwanki Phase 1 — Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Founder connects a Google Sheet/Doc, new vocab appears in a triage inbox after every lesson, gets approved into a deck, and is reviewed daily in an installable PWA with FSRS scheduling and push reminders — replacing the founder's Anki deck within 2 weeks.

**Architecture:** pnpm monorepo, strict TypeScript. React+Vite PWA (`apps/web`) talks to Supabase (Auth + Postgres + Edge Functions). Two shared packages: `packages/core` (types, FSRS wrapper, API client — zero DOM deps) and `packages/parsing` (two-tier source normalizers — zero npm runtime deps, runs in both Node/vitest and Deno Edge Functions). LLM calls are raw `fetch` to the Anthropic API behind an interface. Sync runs on pg_cron → `sync-google` edge function → line-diff snapshot → `llm_jobs` queue → `parse-worker` edge function → `candidate_cards` → triage inbox → `cards` + `card_state` (FSRS) → `review_events`.

**Tech Stack:** TypeScript 5.6, pnpm 9, Vitest 2, React 18 + Vite 5 + Tailwind 3.4 + shadcn/ui, Supabase (supabase-js 2, Edge Functions on Deno), ts-fsrs 4.x, idb 8, vite-plugin-pwa, web-push (edge function).

**Spec:** `docs/superpowers/specs/2026-09-23-schwanki-design.md` — Phase 1 only (§11): Google connectors, two-tier parser, triage inbox, FSRS review PWA, push notifications. Explicitly NOT in this plan: credits/subscriptions/BYOK/enrichment/PDF/extension (Phases 2–3).

## Global Constraints

Every task implicitly includes these (copied from the spec):

- **Strict TypeScript everywhere** (`"strict": true`); one language across apps, packages, and edge functions.
- **Tests are an architectural requirement** — golden fixtures for parsers (§6.4), unit tests for `core` (§10). Every task ends green: `pnpm -r test` must pass before its commit.
- **Teacher content is never auto-corrected** (§3, §12). Parsers normalize formatting only; typos like `arrrive` pass through untouched and surface in triage.
- **Dedup key** is `language + lower(trim(front))`, enforced at the DB level (§5) and in TS as `dedupKey()`.
- **`packages/core` and `packages/parsing` have zero DOM dependencies** and must run in both Node (vitest) and Deno (edge functions). No npm runtime deps in `packages/parsing`; `zod` is the single allowed dependency (imported bare, mapped via `deno.json` in edge functions).
- **Copy voice** comes from `docs/brand/copy.md` — mascot = the Chaos Goose, smug not angry (§9.3). No "Oops! Something went wrong."
- **Brand palette** (§9.3): paper cream surfaces, off-black text, beak-orange accent for CTAs/streaks/due badges, acid yellow sparingly. No Duolingo green, no SaaS blue.
- **Failure isolation** (§6.3): one errored source never blocks others; errors land in `sources.status`/`error_detail` and surface in UI.
- **Incremental-by-default sync** (§6.3): only added lines hit the parser after first import.
- **Secrets never in the repo.** Google/Anthropic/VAPID keys live in Supabase secrets or `.env` (gitignored).
- Commit format: `type: message` (e.g. `feat:`, `test:`, `chore:`), one commit per task minimum.

---

## File Structure

```
pnpm-workspace.yaml
package.json                     # root scripts: test, dev, typecheck
tsconfig.base.json               # strict base config
apps/web/                        # React PWA
  src/lib/supabase.ts            # supabase-js client singleton
  src/lib/auth.ts                # Google OAuth + refresh-token capture
  src/pages/{Sources,Triage,Review,Settings}.tsx
  src/components/{SourceForm,CandidateRow,ReviewCard,StreakScreen}.tsx
  src/offline/{dueCache.ts,outbox.ts}  # idb-backed
  src/main.tsx, src/App.tsx, src/index.css
  public/manifest.webmanifest, public/icons/
  vite.config.ts                 # vite-plugin-pwa
packages/core/
  src/types.ts                   # CandidateCard, Card, Source, ReviewRating...
  src/dedup.ts                   # dedupKey()
  src/fsrs.ts                    # initCardState, scheduleReview (ts-fsrs wrapper)
  src/session.ts                 # buildSessionQueue, applyReview
  src/api.ts                     # typed Supabase API client
  src/*.test.ts
packages/parsing/
  src/types.ts                   # CandidateCard, SourceMeta, ParseResult
  src/csv.ts                     # minimal RFC-4180 line splitter
  src/tier1-sheet.ts             # columnar sheet parser
  src/tier1-doc-table.ts         # tab-separated table parser
  src/tier2-llm.ts               # Anthropic structured-output parser
  src/language.ts                # validateLanguage (unicode-range checks)
  src/orchestrator.ts            # parse(): tier routing, dedup, confidence
  src/prompts/parse-v1.ts        # versioned prompt template
  test/fixtures/                 # anonymized golden fixtures + expected JSON
  src/*.test.ts
supabase/
  config.toml
  migrations/0001_initial.sql    # tables, RLS, dedup index, claim_llm_jobs()
  migrations/0002_cron.sql       # pg_cron + pg_net schedules
  functions/sync-google/index.ts
  functions/parse-worker/index.ts
  functions/push-notify/index.ts
  functions/deno.json            # import map (zod, supabase-js, parsing pkg)
samples/                         # real teacher sources (already committed)
```

Task dependency order is the numbered order below. Tasks 3–5 (`core`) and 6–9 (`parsing`) are independent of each other; 10–12 need 6–9; 13–18 need 2–5.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`

**Interfaces:**
- Produces: workspace with globs `apps/*` and `packages/*`; root scripts `test` (`vitest run` recursive), `typecheck` (`tsc -b --noEmit`); shared strict tsconfig that all packages extend.

- [ ] **Step 1: Create workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json`:
```json
{
  "name": "schwanki",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r --if-present test",
    "typecheck": "pnpm -r --if-present typecheck",
    "dev": "pnpm --filter @schwanki/web dev"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  },
  "packageManager": "pnpm@9.15.0"
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ES2022"]
  }
}
```

`.gitignore` additions (repo git already exists — append if missing): `node_modules`, `dist`, `.env`, `.env.local`, `*.local`, `.supabase`, `apps/web/dev-dist`.

`.env.example`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=see `supabase status`
ANTHROPIC_API_KEY=sk-ant-...
PARSE_MODEL=claude-haiku-4-5
```

- [ ] **Step 2: Verify install and test runner**

Run: `pnpm install && pnpm test`
Expected: install succeeds; `pnpm test` exits 0 (no packages yet → `--if-present` skips).

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore .env.example
git commit -m "chore: pnpm monorepo scaffold with strict TS + vitest"
```

---

### Task 2: Supabase project + initial schema

**Files:**
- Create: `supabase/config.toml` (via CLI), `supabase/migrations/0001_initial.sql`
- Test: `packages/core/src/schema.test.ts` (runs in Task 3 once `core` exists; here the verification is SQL-level via `supabase db reset`)

**Interfaces:**
- Consumes: nothing.
- Produces (all later tasks rely on these exact names):
  - Tables: `sources`, `source_snapshots`, `candidate_cards`, `cards`, `card_state`, `review_events`, `llm_jobs`, `push_subscriptions`, `user_google_tokens`
  - Function: `claim_llm_jobs(batch_size int) returns setof llm_jobs` (SKIP LOCKED)
  - Unique index: `cards_dedup_key` on `cards(user_id, language, lower(btrim(front)))`

- [ ] **Step 1: Init Supabase locally**

Prereq: Supabase CLI installed (`brew install supabase/tap/supabase`) and Docker running.

Run: `supabase init && supabase start`
Expected: `supabase start` prints local API URL (`http://127.0.0.1:54321`), anon key, service_role key. Copy URL + anon key into `.env` (gitignored).

- [ ] **Step 2: Write migration `supabase/migrations/0001_initial.sql`**

```sql
-- Schwanki Phase 1 schema
create extension if not exists pgcrypto;

-- Sources of vocabulary (§5)
create table sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('google_sheet','google_doc','pdf_upload','preply_chat','manual')),
  external_ref text not null,          -- doc/sheet URL or file id
  label text not null,
  language text not null,              -- ISO 639-1: 'zh', 'th', ...
  last_synced_at timestamptz,
  content_hash text,
  status text not null default 'active' check (status in ('active','error','revoked')),
  error_detail text,
  created_at timestamptz not null default now()
);
create index sources_user_idx on sources(user_id);

-- Full-text snapshot per successful fetch, for line-diff incremental sync (§6.3)
create table source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  content text not null,
  fetched_at timestamptz not null default now()
);
create index source_snapshots_source_idx on source_snapshots(source_id, fetched_at desc);

-- Triage inbox (§5)
create table candidate_cards (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  front text not null,
  back text not null,
  reading text,
  example_sentence text,
  raw_context text not null,
  status text not null default 'pending' check (status in ('pending','approved','discarded')),
  confidence real not null default 0.5,
  parse_notes text,
  created_at timestamptz not null default now()
);
create index candidate_cards_inbox_idx on candidate_cards(source_id, status, created_at);

-- Approved deck cards (§5)
create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references sources(id) on delete set null,
  language text not null,
  front text not null,
  back text not null,
  reading text,
  example_sentence text,
  created_at timestamptz not null default now()
);
create unique index cards_dedup_key on cards(user_id, language, lower(btrim(front)));
create index cards_user_idx on cards(user_id);

-- FSRS scheduling state per card (§5)
create table card_state (
  card_id uuid primary key references cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_at timestamptz not null,
  stability real not null default 0,
  difficulty real not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  fsrs jsonb not null,                 -- serialized ts-fsrs Card, source of truth
  last_reviewed_at timestamptz
);
create index card_state_due_idx on card_state(user_id, due_at);

-- Append-only review log (§5)
create table review_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null,
  rating text not null check (rating in ('again','hard','good','easy')),
  elapsed_ms int,
  fsrs_state_before jsonb not null
);
create index review_events_card_idx on review_events(card_id, reviewed_at);

-- Job queue (§4.2). Phase 1 uses type='parse'; enrich_* types arrive in Phase 2.
create table llm_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('parse','enrich_sentence','enrich_audio','enrich_image','enrich_video','ocr')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  last_error text
);
create index llm_jobs_pending_idx on llm_jobs(status, run_after) where status in ('pending','running');

-- Web Push subscriptions (§4.2)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,                 -- { p256dh, auth }
  remind_hour int not null default 9 check (remind_hour between 0 and 23),
  tz text not null default 'UTC',
  created_at timestamptz not null default now()
);
create index push_subscriptions_remind_idx on push_subscriptions(remind_hour);

-- Google OAuth refresh tokens captured at sign-in (needed for private docs, §3)
create table user_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

-- Row-level security
alter table sources enable row level security;
alter table source_snapshots enable row level security;
alter table candidate_cards enable row level security;
alter table cards enable row level security;
alter table card_state enable row level security;
alter table review_events enable row level security;
alter table llm_jobs enable row level security;
alter table push_subscriptions enable row level security;
alter table user_google_tokens enable row level security;

create policy "own sources" on sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own snapshots" on source_snapshots for select using (
  exists (select 1 from sources s where s.id = source_id and s.user_id = auth.uid()));
create policy "own candidates" on candidate_cards for all using (
  exists (select 1 from sources s where s.id = source_id and s.user_id = auth.uid()));
create policy "own cards" on cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own card_state" on card_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own review_events" on review_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- llm_jobs: no user policy — service role only (edge functions bypass RLS)
create policy "own push subs" on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- refresh token: write-only-ish; user can upsert own row, only service role selects
create policy "upsert own google token" on user_google_tokens for insert with check (auth.uid() = user_id);
create policy "update own google token" on user_google_tokens for update using (auth.uid() = user_id);

-- Queue claim with SKIP LOCKED so multiple parse-worker invocations don't double-process
create or replace function claim_llm_jobs(batch_size int)
returns setof llm_jobs language sql as $$
  update llm_jobs
  set status = 'running', attempts = attempts + 1
  where id in (
    select id from llm_jobs
    where status = 'pending' and run_after <= now()
    order by created_at
    limit batch_size
    for update skip locked
  )
  returning *;
$$;
```

- [ ] **Step 3: Apply and verify schema**

Run: `supabase db reset`
Expected: `Applying migration 0001_initial.sql...` then success, no errors.

Run: `supabase db diff --schema public` sanity check is empty output; then in SQL editor or `supabase db shell`:
```sql
insert into sources (user_id, type, external_ref, label, language)
values (gen_random_uuid(), 'google_sheet', 'https://docs.google.com/spreadsheets/d/x', 'test', 'zh');
```
Expected: ERROR — violates RLS/foreign key to auth.users (proves constraints live). Do not leave test rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: initial Postgres schema with RLS, dedup key, and job queue"
```

---

### Task 3: `packages/core` — shared types + dedup

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/types.ts`, `packages/core/src/dedup.ts`, `packages/core/src/dedup.test.ts`

**Interfaces:**
- Produces:
  - `type SourceType = 'google_sheet' | 'google_doc' | 'pdf_upload' | 'preply_chat' | 'manual'`
  - `type ReviewRating = 'again' | 'hard' | 'good' | 'easy'`
  - `interface SchwankiCard { id: string; userId: string; sourceId: string | null; language: string; front: string; back: string; reading?: string; exampleSentence?: string; createdAt: string }`
  - `interface CardState { cardId: string; dueAt: string; stability: number; difficulty: number; reps: number; lapses: number; fsrs: SerializedFsrsCard; lastReviewedAt?: string }`
  - `type SerializedFsrsCard = Record<string, unknown>` (opaque ts-fsrs serialization; only `fsrs.ts` touches its internals)
  - `dedupKey(front: string, language: string): string` — returns `` `${language}:${front.trim().toLowerCase()}` ``

- [ ] **Step 1: Write the failing test**

`packages/core/src/dedup.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { dedupKey } from "./dedup";

describe("dedupKey", () => {
  it("normalizes case and whitespace", () => {
    expect(dedupKey(" 自信 ", "zh")).toBe(dedupKey("自信", "zh"));
    expect(dedupKey("Hello ", "en")).toBe(dedupKey("hello", "en"));
  });
  it("is language-scoped", () => {
    expect(dedupKey("hat", "en")).not.toBe(dedupKey("hat", "de"));
  });
});
```

- [ ] **Step 2: Scaffold package so the test can run**

`packages/core/package.json`:
```json
{
  "name": "@schwanki/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/mod.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.47.10",
    "ts-fsrs": "^4.6.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm install && pnpm --filter @schwanki/core test`
Expected: FAIL — `Cannot find module './dedup'`.

- [ ] **Step 4: Implement types and dedup**

`packages/core/src/types.ts`:
```ts
export type SourceType = "google_sheet" | "google_doc" | "pdf_upload" | "preply_chat" | "manual";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type SerializedFsrsCard = Record<string, unknown>;

export interface SchwankiCard {
  id: string;
  userId: string;
  sourceId: string | null;
  language: string;
  front: string;
  back: string;
  reading?: string;
  exampleSentence?: string;
  createdAt: string;
}

export interface CardState {
  cardId: string;
  dueAt: string; // ISO
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  fsrs: SerializedFsrsCard;
  lastReviewedAt?: string;
}

export interface Source {
  id: string;
  userId: string;
  type: SourceType;
  externalRef: string;
  label: string;
  language: string;
  lastSyncedAt?: string;
  contentHash?: string;
  status: "active" | "error" | "revoked";
  errorDetail?: string;
}

export interface CandidateCardRow {
  id: string;
  sourceId: string;
  front: string;
  back: string;
  reading?: string;
  exampleSentence?: string;
  rawContext: string;
  status: "pending" | "approved" | "discarded";
  confidence: number;
  parseNotes?: string;
  createdAt: string;
}
```

`packages/core/src/dedup.ts`:
```ts
/** Single source of truth for the dedup key; mirrors unique index cards_dedup_key. */
export function dedupKey(front: string, language: string): string {
  return `${language}:${front.trim().toLowerCase()}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @schwanki/core test`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): shared types + dedupKey"
```

---

### Task 4: `packages/core` — FSRS wrapper

**Files:**
- Create: `packages/core/src/fsrs.ts`, `packages/core/src/fsrs.test.ts`
- Modify: `packages/core/src/mod.ts` (create — re-exports)

**Interfaces:**
- Consumes: `ReviewRating`, `SerializedFsrsCard` from `./types`.
- Produces:
  - `initCardState(now: Date): { dueAt: Date; fsrs: SerializedFsrsCard }`
  - `scheduleReview(fsrs: SerializedFsrsCard, rating: ReviewRating, now: Date): { dueAt: Date; stability: number; difficulty: number; reps: number; lapses: number; fsrs: SerializedFsrsCard }`
  - `isDue(fsrs: SerializedFsrsCard, now: Date): boolean`

The wrapper isolates ts-fsrs so a library upgrade touches one file. Serialization: ts-fsrs `Card` is a plain object; `due`/`last_review` are Dates → serialized as ISO strings, revived on read.

- [ ] **Step 1: Write the failing test**

`packages/core/src/fsrs.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { initCardState, scheduleReview, isDue } from "./fsrs";

describe("fsrs wrapper", () => {
  it("new cards are due immediately", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const { fsrs } = initCardState(now);
    expect(isDue(fsrs, now)).toBe(true);
  });

  it("rating 'good' pushes due_at into the future", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const { fsrs } = initCardState(now);
    const next = scheduleReview(fsrs, "good", now);
    expect(next.dueAt.getTime()).toBeGreaterThan(now.getTime());
    expect(next.reps).toBe(1);
  });

  it("'again' reschedules sooner than 'easy'", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const { fsrs } = initCardState(now);
    const again = scheduleReview(fsrs, "again", now);
    const easy = scheduleReview(fsrs, "easy", now);
    expect(again.dueAt.getTime()).toBeLessThan(easy.dueAt.getTime());
  });

  it("state round-trips through serialization", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const first = scheduleReview(initCardState(now).fsrs, "good", now);
    const revived = JSON.parse(JSON.stringify(first.fsrs));
    const second = scheduleReview(revived, "good", first.dueAt);
    expect(second.reps).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/core test`
Expected: FAIL — `Cannot find module './fsrs'`.

- [ ] **Step 3: Implement the wrapper**

`packages/core/src/fsrs.ts`:
```ts
import {
  FSRS,
  Rating,
  createEmptyCard,
  generatorParameters,
  type Card as FsrsCard,
} from "ts-fsrs";
import type { ReviewRating, SerializedFsrsCard } from "./types";

const engine = new FSRS(generatorParameters({ enable_fuzz: true }));

const RATING_MAP: Record<ReviewRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function serialize(card: FsrsCard): SerializedFsrsCard {
  return JSON.parse(
    JSON.stringify(card, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  );
}

function deserialize(raw: SerializedFsrsCard): FsrsCard {
  const card = { ...raw } as Record<string, unknown>;
  if (typeof card.due === "string") card.due = new Date(card.due);
  if (typeof card.last_review === "string") card.last_review = new Date(card.last_review);
  return card as unknown as FsrsCard;
}

export function initCardState(now: Date): { dueAt: Date; fsrs: SerializedFsrsCard } {
  const card = createEmptyCard(now);
  return { dueAt: card.due, fsrs: serialize(card) };
}

export function scheduleReview(
  fsrs: SerializedFsrsCard,
  rating: ReviewRating,
  now: Date,
): { dueAt: Date; stability: number; difficulty: number; reps: number; lapses: number; fsrs: SerializedFsrsCard } {
  const card = deserialize(fsrs);
  const scheduled = engine.repeat(card, now);
  const item = scheduled[RATING_MAP[rating]];
  const next = item.card;
  return {
    dueAt: next.due,
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    fsrs: serialize(next),
  };
}

export function isDue(fsrs: SerializedFsrsCard, now: Date): boolean {
  return deserialize(fsrs).due.getTime() <= now.getTime();
}
```

`packages/core/src/mod.ts`:
```ts
export * from "./types";
export * from "./dedup";
export * from "./fsrs";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @schwanki/core test`
Expected: PASS, all 4 fsrs tests. If ts-fsrs API has drifted (version bump), adjust `fsrs.ts` internals until the tests pass — the tests are the contract.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): FSRS scheduling wrapper over ts-fsrs"
```

---

### Task 5: `packages/core` — session logic + API client

**Files:**
- Create: `packages/core/src/session.ts`, `packages/core/src/session.test.ts`, `packages/core/src/api.ts`, `packages/core/src/api.test.ts`
- Modify: `packages/core/src/mod.ts`

**Interfaces:**
- Consumes: `SchwankiCard`, `CardState`, `ReviewRating`, `dedupKey`, `scheduleReview`, `isDue`.
- Produces:
  - `interface DueCard { card: SchwankiCard; state: CardState | null }` (`state` null = new card)
  - `buildSessionQueue(due: DueCard[], now: Date, limit?: number): DueCard[]` — learning/again cards first (due soonest), then due reviews by `dueAt` asc, then new cards; default limit 50.
  - `applyReview(dueCard: DueCard, rating: ReviewRating, now: Date): { state: CardState; event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard } }`
  - `class SchwankiApi` wrapping supabase-js with methods used by the web app:
    - `listSources(): Promise<Source[]>`
    - `addSource(input: { type: SourceType; externalRef: string; label: string; language: string }): Promise<Source>`
    - `listPendingCandidates(): Promise<CandidateCardRow[]>`
    - `setCandidateStatus(id: string, status: 'approved' | 'discarded'): Promise<void>`
    - `approveCandidate(candidate: CandidateCardRow): Promise<'created' | 'duplicate'>` — inserts into `cards` + `card_state` (initCardState), on dedup conflict returns `'duplicate'`; then sets candidate status.
    - `listDueCards(now: Date, limit?: number): Promise<DueCard[]>`
    - `saveReview(state: CardState, event: {...}): Promise<void>` — upsert `card_state` + append `review_events`.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/session.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSessionQueue, applyReview, type DueCard } from "./session";
import { initCardState, scheduleReview } from "./fsrs";
import type { SchwankiCard, CardState } from "./types";

const NOW = new Date("2026-09-24T10:00:00Z");

function mkCard(id: string): SchwankiCard {
  return { id, userId: "u1", sourceId: null, language: "zh", front: `w${id}`, back: "t", createdAt: NOW.toISOString() };
}

function mkDue(id: string, dueAt: Date): DueCard {
  const { fsrs } = initCardState(NOW);
  const state: CardState = {
    cardId: id, dueAt: dueAt.toISOString(), stability: 1, difficulty: 5,
    reps: 1, lapses: 0, fsrs, lastReviewedAt: NOW.toISOString(),
  };
  return { card: mkCard(id), state };
}

describe("buildSessionQueue", () => {
  it("orders: overdue first by dueAt, then new cards; respects limit", () => {
    const old = mkDue("old", new Date("2026-09-20T10:00:00Z"));
    const recent = mkDue("recent", new Date("2026-09-24T09:00:00Z"));
    const fresh: DueCard = { card: mkCard("new"), state: null };
    const queue = buildSessionQueue([fresh, recent, old], NOW, 50);
    expect(queue.map((d) => d.card.id)).toEqual(["old", "recent", "new"]);
    expect(buildSessionQueue([old, recent, fresh], NOW, 2)).toHaveLength(2);
  });
});

describe("applyReview", () => {
  it("new card: creates state and event with the pre-review fsrs snapshot", () => {
    const fresh: DueCard = { card: mkCard("c1"), state: null };
    const { state, event } = applyReview(fresh, "good", NOW);
    expect(state.cardId).toBe("c1");
    expect(state.reps).toBe(1);
    expect(event.rating).toBe("good");
    expect(event.cardId).toBe("c1");
    expect(event.fsrsStateBefore).toBeDefined();
  });

  it("existing card: advances scheduling", () => {
    const { fsrs } = initCardState(NOW);
    const grown = scheduleReview(fsrs, "good", NOW);
    const due = mkDue("c2", NOW);
    due.state!.fsrs = grown.fsrs;
    const { state } = applyReview(due, "easy", new Date("2026-09-25T10:00:00Z"));
    expect(state.reps).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/core test`
Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: Implement session logic**

`packages/core/src/session.ts`:
```ts
import { initCardState, scheduleReview } from "./fsrs";
import type { CardState, ReviewRating, SchwankiCard, SerializedFsrsCard } from "./types";

export interface DueCard {
  card: SchwankiCard;
  state: CardState | null; // null = never reviewed
}

/** Overdue/learning cards first (oldest dueAt), new cards last. Limit defaults to 50. */
export function buildSessionQueue(due: DueCard[], _now: Date, limit = 50): DueCard[] {
  const withState = due
    .filter((d) => d.state !== null)
    .sort((a, b) => a.state!.dueAt.localeCompare(b.state!.dueAt));
  const fresh = due.filter((d) => d.state === null);
  return [...withState, ...fresh].slice(0, limit);
}

export function applyReview(
  dueCard: DueCard,
  rating: ReviewRating,
  now: Date,
): {
  state: CardState;
  event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard };
} {
  const before: SerializedFsrsCard =
    dueCard.state?.fsrs ?? initCardState(now).fsrs;
  const next = scheduleReview(before, rating, now);
  return {
    state: {
      cardId: dueCard.card.id,
      dueAt: next.dueAt.toISOString(),
      stability: next.stability,
      difficulty: next.difficulty,
      reps: next.reps,
      lapses: next.lapses,
      fsrs: next.fsrs,
      lastReviewedAt: now.toISOString(),
    },
    event: {
      cardId: dueCard.card.id,
      rating,
      reviewedAt: now.toISOString(),
      fsrsStateBefore: before,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @schwanki/core test`
Expected: PASS (session + fsrs + dedup all green).

- [ ] **Step 5: Implement the API client**

`packages/core/src/api.ts` — snake_case ↔ camelCase mapping happens here and nowhere else. Full implementation:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { initCardState } from "./fsrs";
import type {
  CandidateCardRow, CardState, ReviewRating, SchwankiCard, SerializedFsrsCard, Source, SourceType,
} from "./types";
import type { DueCard } from "./session";

export class SchwankiApi {
  constructor(private db: SupabaseClient) {}

  async listSources(): Promise<Source[]> {
    const { data, error } = await this.db.from("sources").select("*").order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapSource);
  }

  async addSource(input: { type: SourceType; externalRef: string; label: string; language: string }): Promise<Source> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data, error } = await this.db
      .from("sources")
      .insert({ user_id: user.id, type: input.type, external_ref: input.externalRef, label: input.label, language: input.language })
      .select()
      .single();
    if (error) throw error;
    return mapSource(data);
  }

  async listPendingCandidates(): Promise<CandidateCardRow[]> {
    const { data, error } = await this.db
      .from("candidate_cards")
      .select("*")
      .eq("status", "pending")
      .order("confidence", { ascending: true }) // sketchy parses first (§5)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapCandidate);
  }

  async setCandidateStatus(id: string, status: "approved" | "discarded"): Promise<void> {
    const { error } = await this.db.from("candidate_cards").update({ status }).eq("id", id);
    if (error) throw error;
  }

  /** Approve a candidate: insert into cards + initial card_state. Dedup conflicts return 'duplicate'. */
  async approveCandidate(candidate: CandidateCardRow): Promise<"created" | "duplicate"> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data: source } = await this.db.from("sources").select("language").eq("id", candidate.sourceId).single();
    const language = source?.language ?? "en";
    const { data: card, error } = await this.db
      .from("cards")
      .insert({
        user_id: user.id, source_id: candidate.sourceId, language,
        front: candidate.front, back: candidate.back,
        reading: candidate.reading ?? null, example_sentence: candidate.exampleSentence ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") { // unique violation = cards_dedup_key
        await this.setCandidateStatus(candidate.id, "discarded");
        return "duplicate";
      }
      throw error;
    }
    const init = initCardState(new Date());
    const { error: stateErr } = await this.db.from("card_state").insert({
      card_id: card.id, user_id: user.id, due_at: init.dueAt.toISOString(), fsrs: init.fsrs,
    });
    if (stateErr) throw stateErr;
    await this.setCandidateStatus(candidate.id, "approved");
    return "created";
  }

  async listDueCards(now: Date, limit = 50): Promise<DueCard[]> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data, error } = await this.db
      .from("cards")
      .select("*, card_state(*)")
      .eq("user_id", user.id)
      .order("created_at");
    if (error) throw error;
    const cutoff = now.toISOString();
    return (data ?? [])
      .map((row) => {
        const rawState = Array.isArray(row.card_state) ? row.card_state[0] : row.card_state;
        return { card: mapCard(row), state: rawState ? mapState(rawState) : null };
      })
      .filter((d) => d.state === null || d.state.dueAt <= cutoff) // null state = new card, always due
      .slice(0, limit);
  }

  async saveReview(
    state: CardState,
    event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard; elapsedMs?: number },
  ): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { error: sErr } = await this.db.from("card_state").upsert({
      card_id: state.cardId, user_id: user.id, due_at: state.dueAt,
      stability: state.stability, difficulty: state.difficulty,
      reps: state.reps, lapses: state.lapses, fsrs: state.fsrs,
      last_reviewed_at: state.lastReviewedAt ?? null,
    });
    if (sErr) throw sErr;
    const { error: eErr } = await this.db.from("review_events").insert({
      card_id: event.cardId, user_id: user.id, reviewed_at: event.reviewedAt,
      rating: event.rating, elapsed_ms: event.elapsedMs ?? null,
      fsrs_state_before: event.fsrsStateBefore,
    });
    if (eErr) throw eErr;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSource(r: any): Source {
  return { id: r.id, userId: r.user_id, type: r.type, externalRef: r.external_ref, label: r.label,
    language: r.language, lastSyncedAt: r.last_synced_at ?? undefined, contentHash: r.content_hash ?? undefined,
    status: r.status, errorDetail: r.error_detail ?? undefined };
}
function mapCandidate(r: any): CandidateCardRow {
  return { id: r.id, sourceId: r.source_id, front: r.front, back: r.back,
    reading: r.reading ?? undefined, exampleSentence: r.example_sentence ?? undefined,
    rawContext: r.raw_context, status: r.status, confidence: r.confidence,
    parseNotes: r.parse_notes ?? undefined, createdAt: r.created_at };
}
function mapCard(r: any): SchwankiCard {
  return { id: r.id, userId: r.user_id, sourceId: r.source_id, language: r.language,
    front: r.front, back: r.back, reading: r.reading ?? undefined,
    exampleSentence: r.example_sentence ?? undefined, createdAt: r.created_at };
}
function mapState(r: any): CardState {
  return { cardId: r.card_id, dueAt: r.due_at, stability: r.stability, difficulty: r.difficulty,
    reps: r.reps, lapses: r.lapses, fsrs: r.fsrs, lastReviewedAt: r.last_reviewed_at ?? undefined };
}
```

Add to `packages/core/src/mod.ts`: `export * from "./session";` and `export * from "./api";`.

- [ ] **Step 6: Typecheck + test, then commit**

Run: `pnpm --filter @schwanki/core typecheck && pnpm --filter @schwanki/core test`
Expected: both pass. (`api.ts` correctness against a live DB is exercised by Task 16's manual end-to-end verification — here typecheck is the gate.)

```bash
git add packages/core
git commit -m "feat(core): session queue logic + Supabase API client"
```

---

### Task 6: `packages/parsing` — types, language validation, orchestrator shell

**Files:**
- Create: `packages/parsing/package.json`, `packages/parsing/tsconfig.json`, `packages/parsing/src/types.ts`, `packages/parsing/src/language.ts`, `packages/parsing/src/language.test.ts`, `packages/parsing/src/csv.ts`, `packages/parsing/src/csv.test.ts`

**Interfaces:**
- Produces:
  - `interface CandidateCard { front: string; back: string; reading?: string; exampleSentence?: string; rawContext: string; confidence: number; parseNotes?: string }`
  - `interface SourceMeta { type: SourceType; language: string; externalRef?: string }`
  - `interface TierResult { cards: CandidateCard[]; unparsed: string[] }` — `unparsed` = raw lines Tier 1 couldn't handle, forwarded to Tier 2.
  - `validateLanguage(front: string, language: string): boolean`
  - `parseCsvLine(line: string): string[]` — RFC-4180 minimal splitter (handles `"quoted, cells"` and `""` escapes)
  - `parse(rawContent: string, meta: SourceMeta, llm?: LlmProvider): Promise<CandidateCard[]>` (orchestrator — implemented in Task 9, signature fixed now)

- [ ] **Step 1: Write the failing tests**

`packages/parsing/src/language.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateLanguage } from "./language";

describe("validateLanguage", () => {
  it("accepts CJK fronts for zh", () => {
    expect(validateLanguage("自信", "zh")).toBe(true);
    expect(validateLanguage("未來感", "zh")).toBe(true); // traditional also fine
  });
  it("rejects pure-English fronts for zh (cross-language contamination)", () => {
    expect(validateLanguage("confidence", "zh")).toBe(false);
  });
  it("accepts Thai script for th, rejects Latin", () => {
    expect(validateLanguage("ส่ง", "th")).toBe(true);
    expect(validateLanguage("song", "th")).toBe(false);
  });
  it("passes unknown languages through", () => {
    expect(validateLanguage("anything", "eo")).toBe(true);
  });
});
```

`packages/parsing/src/csv.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseCsvLine } from "./csv";

describe("parseCsvLine", () => {
  it("splits simple rows", () => {
    expect(parseCsvLine(",自信,confidence,zì xìn,")).toEqual(["", "自信", "confidence", "zì xìn", ""]);
  });
  it("handles quoted cells with commas", () => {
    expect(parseCsvLine(',"hello, world",x')).toEqual(["", "hello, world", "x"]);
  });
  it("handles escaped quotes", () => {
    expect(parseCsvLine('"she said ""hi""",x')).toEqual(['she said "hi"', "x"]);
  });
});
```

- [ ] **Step 2: Scaffold package, run tests to verify they fail**

`packages/parsing/package.json`:
```json
{
  "name": "@schwanki/parsing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/mod.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@schwanki/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

`packages/parsing/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

Run: `pnpm install && pnpm --filter @schwanki/parsing test`
Expected: FAIL — modules `./language`, `./csv` not found.

- [ ] **Step 3: Implement**

`packages/parsing/src/types.ts`:
```ts
import type { SourceType } from "@schwanki/core";

export interface CandidateCard {
  front: string;
  back: string;
  reading?: string;
  exampleSentence?: string;
  /** Exactly what the parser saw — for debugging and user trust (§5). */
  rawContext: string;
  /** 0..1, sorts sketchy parses first in triage (§5). */
  confidence: number;
  parseNotes?: string;
}

export interface SourceMeta {
  type: SourceType;
  language: string; // ISO 639-1
  externalRef?: string;
}

export interface TierResult {
  cards: CandidateCard[];
  /** Raw lines Tier 1 declined; forwarded to Tier 2. */
  unparsed: string[];
}

/** LLM provider abstraction — raw fetch, no SDK, so this package runs in Node AND Deno. */
export interface LlmProvider {
  /** Send a prompt, get back JSON matching the card schema. Implementations must be deterministic-ish (temperature 0). */
  parseCards(prompt: string): Promise<unknown>;
}
```

`packages/parsing/src/language.ts`:
```ts
const RANGES: Record<string, RegExp> = {
  zh: /[一-鿿]/,        // CJK unified ideographs
  th: /[ก-๙]/,          // Thai block
  ko: /[가-힯]/,
  ja: /[぀-ヿ一-鿿]/,
  ru: /[Ѐ-ӿ]/,
  ar: /[؀-ۿ]/,
};

/**
 * Guards against cross-language contamination (§6.3): an English gloss must not
 * become a target-language card front. Unknown languages pass through.
 */
export function validateLanguage(front: string, language: string): boolean {
  const range = RANGES[language];
  if (!range) return true;
  return range.test(front);
}
```

`packages/parsing/src/csv.ts`:
```ts
/** Minimal RFC-4180 splitter for one CSV line. Zero deps by design (dual Node/Deno runtime). */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur); cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}
```

- [ ] **Step 4: Run tests to verify they pass, commit**

Run: `pnpm --filter @schwanki/parsing test`
Expected: PASS, 7 tests.

```bash
git add packages/parsing
git commit -m "feat(parsing): types, language validation, zero-dep CSV splitter"
```

---

### Task 7: Tier 1 — sheet parser + golden fixture (real Chinese sheet)

**Files:**
- Create: `packages/parsing/test/fixtures/zh-sheet.csv`, `packages/parsing/test/fixtures/zh-sheet.expected.json`
- Create: `packages/parsing/src/tier1-sheet.ts`, `packages/parsing/src/tier1-sheet.test.ts`

**Interfaces:**
- Consumes: `CandidateCard`, `TierResult` from `./types`; `parseCsvLine`; `validateLanguage`.
- Produces: `parseSheet(raw: string, meta: SourceMeta): TierResult` — columnar rule-based parser (§6.2 Tier 1). Emits confidence 0.95 for full rows, 0.6 for two-column rows; drops `#VALUE!` rows, header rows, empty rows into `unparsed` only if they contain target-language script (else silently skips).

- [ ] **Step 1: Create the anonymized golden fixture**

`packages/parsing/test/fixtures/zh-sheet.csv` — derived from `samples/sheet1.csv` (first rows + edge cases; vocab is generic, no PII, so rows are kept verbatim; any row containing a personal name must be replaced):
```csv
,自信,confidence,zì xìn,
,未來感,futuristic,wèi lái gǎn,
,投资,invest,tóu zī,
,退休,retire,tuì xiū,
,让我大开眼界,It broadened my horizons,ràng wǒ dà kāi yǎn jiè,
,恶ě心,nauseous,,
,#VALUE!,#VALUE!,#VALUE!,#VALUE!,
,自信,confidence,zì xìn,
,口罩,mask,kǒu zhào,
,confidence,,,
```

(Row 6 has pinyin fused into the character `恶ě心` — Tier 1 must pass it through with a `parseNotes` flag, NOT fix it; row 8 is an exact duplicate of row 1 → within-batch dedup must drop it; row 10 has an English front → `validateLanguage` rejects for `zh` → goes to `unparsed`.)

`packages/parsing/test/fixtures/zh-sheet.expected.json`:
```json
{
  "cards": [
    { "front": "自信", "back": "confidence", "reading": "zì xìn" },
    { "front": "未來感", "back": "futuristic", "reading": "wèi lái gǎn" },
    { "front": "投资", "back": "invest", "reading": "tóu zī" },
    { "front": "退休", "back": "retire", "reading": "tuì xiū" },
    { "front": "让我大开眼界", "back": "It broadened my horizons", "reading": "ràng wǒ dà kāi yǎn jiè" },
    { "front": "恶ě心", "back": "nauseous" },
    { "front": "口罩", "back": "mask", "reading": "kǒu zhào" }
  ],
  "unparsedCount": 1
}
```

- [ ] **Step 2: Write the failing test**

`packages/parsing/src/tier1-sheet.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseSheet } from "./tier1-sheet";
import { dedupKey } from "@schwanki/core";
import type { SourceMeta } from "./types";

const META: SourceMeta = { type: "google_sheet", language: "zh" };

describe("parseSheet (golden fixture)", () => {
  const raw = readFileSync(new URL("../test/fixtures/zh-sheet.csv", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("../test/fixtures/zh-sheet.expected.json", import.meta.url), "utf8"),
  );
  const result = parseSheet(raw, META);

  it("parses every expected row with front/back/reading", () => {
    expect(result.cards).toHaveLength(expected.cards.length);
    for (const [i, exp] of expected.cards.entries()) {
      expect(result.cards[i]!.front).toBe(exp.front);
      expect(result.cards[i]!.back).toBe(exp.back);
      if (exp.reading) expect(result.cards[i]!.reading).toBe(exp.reading);
    }
  });

  it("never auto-corrects fused pinyin (恶ě心 passes through, flagged)", () => {
    const fused = result.cards.find((c) => c.front === "恶ě心");
    expect(fused).toBeDefined();
    expect(fused!.parseNotes).toMatch(/fused|suspicious/i);
  });

  it("drops #VALUE! rows entirely", () => {
    expect(result.cards.some((c) => c.rawContext.includes("#VALUE!"))).toBe(false);
  });

  it("dedups within batch", () => {
    const keys = result.cards.map((c) => dedupKey(c.front, "zh"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("escalates language-invalid rows to unparsed", () => {
    expect(result.unparsed).toHaveLength(expected.unparsedCount);
    expect(result.unparsed[0]).toContain("confidence");
  });

  it("preserves rawContext verbatim", () => {
    expect(result.cards[0]!.rawContext).toBe(",自信,confidence,zì xìn,");
  });

  it("assigns confidence: 0.95 full rows, 0.6 minimal rows", () => {
    expect(result.cards[0]!.confidence).toBe(0.95);
    const fused = result.cards.find((c) => c.front === "恶ě心")!;
    expect(fused.confidence).toBeLessThan(0.8);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @schwanki/parsing test`
Expected: FAIL — `./tier1-sheet` not found (and `@schwanki/core` must resolve — add `"@schwanki/core": "workspace:*"` to parsing's dependencies if missing).

- [ ] **Step 4: Implement the parser**

`packages/parsing/src/tier1-sheet.ts`:
```ts
import { dedupKey } from "@schwanki/core";
import { parseCsvLine } from "./csv";
import { validateLanguage } from "./language";
import type { CandidateCard, SourceMeta, TierResult } from "./types";

const LATIN_IN_CJK = /[一-鿿][a-zA-Z]|[a-zA-Z][一-鿿]/;

/**
 * Tier 1 deterministic parser for columnar sheets (§6.2).
 * Column order observed in real sources: [date?, word, translation, pinyin?, ...].
 * Normalizes formatting ONLY — teacher content is never corrected (§3).
 */
export function parseSheet(raw: string, meta: SourceMeta): TierResult {
  const cards: CandidateCard[] = [];
  const unparsed: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("#VALUE!")) continue; // spreadsheet error rows

    const cells = parseCsvLine(trimmed).map((c) => c.trim());
    const nonEmpty = cells.filter(Boolean);
    // Lone cells (e.g. ",confidence,,,") are anomalous rows — escalate to Tier 2 (§6.2)
    if (nonEmpty.length < 2) { if (nonEmpty.length === 1) unparsed.push(trimmed); continue; }

    // Header detection: first cell(s) look like English column names
    if (/^(date|word|thai|chinese|pronunciation|meaning|pinyin)/i.test(nonEmpty[0]!)) continue;

    const [front, back, reading] = pickColumns(cells);
    if (!front || !back) { unparsed.push(trimmed); continue; }
    if (!validateLanguage(front, meta.language)) { unparsed.push(trimmed); continue; }

    const key = dedupKey(front, meta.language);
    if (seen.has(key)) continue;
    seen.add(key);

    const fused = meta.language === "zh" && LATIN_IN_CJK.test(front);
    cards.push({
      front,
      back,
      ...(reading ? { reading } : {}),
      rawContext: trimmed,
      confidence: fused ? 0.6 : reading ? 0.95 : 0.85,
      ...(fused ? { parseNotes: "suspicious: latin characters fused into front (fused pinyin?)" } : {}),
    });
  }
  return { cards, unparsed };
}

/** Heuristic column mapping: skip leading date-ish cell, then [front, back, reading]. */
function pickColumns(cells: string[]): [string?, string?, string?] {
  const rest = cells.filter(Boolean);
  // Skip a leading date-ish cell (empty already filtered; match yyyy-mm-dd, dd/mm, etc.)
  const start = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$|^\d{1,2}[-/]\d{1,2}$/.test(rest[0] ?? "") ? 1 : 0;
  return [rest[start], rest[start + 1], rest[start + 2]] as [string?, string?, string?];
}
```

- [ ] **Step 5: Run tests to verify they pass, commit**

Run: `pnpm --filter @schwanki/parsing test`
Expected: PASS including all 7 golden-fixture assertions. If an assertion fails, fix the parser — never the fixture (the fixture encodes the real teacher's data).

```bash
git add packages/parsing
git commit -m "feat(parsing): tier-1 sheet parser with zh golden fixture"
```

---

### Task 8: Tier 1 — tab-separated doc-table parser (real Thai doc)

**Files:**
- Create: `packages/parsing/test/fixtures/th-doc-table.txt`, `packages/parsing/test/fixtures/th-doc-table.expected.json`
- Create: `packages/parsing/src/tier1-doc-table.ts`, `packages/parsing/src/tier1-doc-table.test.ts`

**Interfaces:**
- Consumes: same as Task 7.
- Produces: `parseDocTable(raw: string, meta: SourceMeta): TierResult` — handles tab-separated `word \t pronunciation \t meaning` blocks; everything not tab-separated (e.g. the doc's per-word `Examples:` sections) goes to `unparsed` for Tier 2.

- [ ] **Step 1: Create the golden fixture from `samples/doc1.txt`**

`packages/parsing/test/fixtures/th-doc-table.txt` (verbatim slice of the real doc's table block, including the header row and the `arrrive` typo — which MUST pass through uncorrected):
```
Thai	Pronunciation	Meaning
ส่ง	sòng	send
เริ่ม	rôerm	start
เสร็จ	sèt	finish
ซื้อ	sʉ́ʉ	buy
ขาย	khǎai	sell
ถึง	thʉ̌ng	arrrive

1. รับผิดชอบ 
Examples:
เขาไม่ยอมรับผิดชอบ
khăo mâi yɔɔm ráp-phìt-chɔ̂ɔp
→ He refuses to take responsibility.
```

`packages/parsing/test/fixtures/th-doc-table.expected.json`:
```json
{
  "cards": [
    { "front": "ส่ง", "back": "send", "reading": "sòng" },
    { "front": "เริ่ม", "back": "start", "reading": "rôerm" },
    { "front": "เสร็จ", "back": "finish", "reading": "sèt" },
    { "front": "ซื้อ", "back": "buy", "reading": "sʉ́ʉ" },
    { "front": "ขาย", "back": "sell", "reading": "khǎai" },
    { "front": "ถึง", "back": "arrrive", "reading": "thʉ̌ng" }
  ]
}
```

- [ ] **Step 2: Write the failing test**

`packages/parsing/src/tier1-doc-table.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseDocTable } from "./tier1-doc-table";
import type { SourceMeta } from "./types";

const META: SourceMeta = { type: "google_doc", language: "th" };

describe("parseDocTable (golden fixture)", () => {
  const raw = readFileSync(new URL("../test/fixtures/th-doc-table.txt", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("../test/fixtures/th-doc-table.expected.json", import.meta.url), "utf8"),
  );
  const result = parseDocTable(raw, META);

  it("parses tab-separated rows as front/reading/back", () => {
    expect(result.cards).toHaveLength(expected.cards.length);
    for (const [i, exp] of expected.cards.entries()) {
      expect(result.cards[i]!.front).toBe(exp.front);
      expect(result.cards[i]!.back).toBe(exp.back);
      expect(result.cards[i]!.reading).toBe(exp.reading);
    }
  });

  it("skips the header row", () => {
    expect(result.cards.some((c) => c.front === "Thai")).toBe(false);
  });

  it("NEVER fixes the teacher's typo (arrrive survives verbatim)", () => {
    expect(result.cards.find((c) => c.front === "ถึง")!.back).toBe("arrrive");
  });

  it("forwards the non-tabular Examples section to Tier 2 via unparsed", () => {
    const joined = result.unparsed.join("\n");
    expect(joined).toContain("รับผิดชอบ");
    expect(joined).toContain("→ He refuses to take responsibility.");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @schwanki/parsing test`
Expected: FAIL — `./tier1-doc-table` not found.

- [ ] **Step 4: Implement**

`packages/parsing/src/tier1-doc-table.ts`:
```ts
import { dedupKey } from "@schwanki/core";
import { validateLanguage } from "./language";
import type { CandidateCard, SourceMeta, TierResult } from "./types";

/**
 * Tier 1 parser for tab-separated vocab tables inside Google Docs (§6.2).
 * Column order in the real Thai source: word \t pronunciation \t meaning.
 * Non-tabular lines are returned as `unparsed` for Tier 2.
 */
export function parseDocTable(raw: string, meta: SourceMeta): TierResult {
  const cards: CandidateCard[] = [];
  const unparsed: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes("\t")) { unparsed.push(trimmed); continue; }

    const cells = trimmed.split("\t").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) { unparsed.push(trimmed); continue; }
    if (/^(thai|word|pronunciation|meaning|pinyin|chinese)$/i.test(cells[0]!)) continue; // header

    const [front, reading, back] = cells as [string, string?, string?];
    const realBack = back ?? reading; // 2-column rows: word \t meaning
    const realReading = back ? reading : undefined;
    if (!front || !realBack) { unparsed.push(trimmed); continue; }
    if (!validateLanguage(front, meta.language)) { unparsed.push(trimmed); continue; }

    const key = dedupKey(front, meta.language);
    if (seen.has(key)) continue;
    seen.add(key);

    cards.push({
      front,
      back: realBack,
      ...(realReading ? { reading: realReading } : {}),
      rawContext: trimmed,
      confidence: 0.9,
    });
  }
  return { cards, unparsed };
}
```

- [ ] **Step 5: Run tests to verify they pass, commit**

Run: `pnpm --filter @schwanki/parsing test`
Expected: PASS, 4 new assertions.

```bash
git add packages/parsing
git commit -m "feat(parsing): tier-1 doc-table parser with th golden fixture"
```

---

### Task 9: Tier 2 — LLM structured output + orchestrator

**Files:**
- Create: `packages/parsing/src/prompts/parse-v1.ts`, `packages/parsing/src/tier2-llm.ts`, `packages/parsing/src/tier2-llm.test.ts`, `packages/parsing/src/anthropic.ts`, `packages/parsing/src/orchestrator.ts`, `packages/parsing/src/orchestrator.test.ts`, `packages/parsing/src/mod.ts`
- Create: `packages/parsing/test/fixtures/th-doc-sections.txt`, `packages/parsing/test/fixtures/th-doc-sections.llm-response.json`

**Interfaces:**
- Consumes: `LlmProvider`, `CandidateCard`, `SourceMeta`, `TierResult` from `./types`; `parseSheet`, `parseDocTable`.
- Produces:
  - `PARSE_PROMPT_V1(sourceMeta, chunk: string): string` — versioned prompt template (§4.2: prompts are versioned like code).
  - `parseWithLlm(chunk: string, meta: SourceMeta, llm: LlmProvider): Promise<CandidateCard[]>` — validates the LLM JSON, drops invalid entries, caps confidence at 0.8 (LLM parses are inherently less certain than Tier 1).
  - `createAnthropicProvider(apiKey: string, model?: string): LlmProvider` — raw fetch to `https://api.anthropic.com/v1/messages`, tool-use forced JSON, temperature 0. Default model from `PARSE_MODEL` env or `claude-haiku-4-5`.
  - `parse(rawContent: string, meta: SourceMeta, llm?: LlmProvider): Promise<CandidateCard[]>` — the single entry point the edge function calls (§4.2). Routes: `google_sheet` → `parseSheet`; `google_doc` → `parseDocTable`; other types → everything to Tier 2. Tier-1 `unparsed` lines go to Tier 2 when `llm` is provided; without an `llm`, unparsed lines are dropped (callers in tests rely on this).

- [ ] **Step 1: Create fixtures for the section format**

`packages/parsing/test/fixtures/th-doc-sections.txt` (verbatim from `samples/doc1.txt`):
```
1. รับผิดชอบ 
Examples:
เขาไม่ยอมรับผิดชอบ
khăo mâi yɔɔm ráp-phìt-chɔ̂ɔp
→ He refuses to take responsibility.
```

`packages/parsing/test/fixtures/th-doc-sections.llm-response.json` (what the LLM is expected to return — recorded shape used by the mocked provider):
```json
{
  "cards": [
    {
      "front": "รับผิดชอบ",
      "back": "to take responsibility",
      "reading": "ráp-phìt-chɔ̂ɔp",
      "example": "เขาไม่ยอมรับผิดชอบ — He refuses to take responsibility.",
      "confidence": 0.8
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/parsing/src/tier2-llm.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseWithLlm } from "./tier2-llm";
import type { LlmProvider, SourceMeta } from "./types";

const META: SourceMeta = { type: "google_doc", language: "th" };
const chunk = readFileSync(new URL("../test/fixtures/th-doc-sections.txt", import.meta.url), "utf8");
const recorded = JSON.parse(
  readFileSync(new URL("../test/fixtures/th-doc-sections.llm-response.json", import.meta.url), "utf8"),
);

const mockLlm: LlmProvider = { parseCards: async () => recorded };

describe("parseWithLlm", () => {
  it("maps valid LLM JSON to CandidateCards with rawContext", async () => {
    const cards = await parseWithLlm(chunk, META, mockLlm);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.front).toBe("รับผิดชอบ");
    expect(cards[0]!.exampleSentence).toContain("He refuses");
    expect(cards[0]!.rawContext).toBe(chunk);
    expect(cards[0]!.confidence).toBeLessThanOrEqual(0.8);
  });

  it("drops malformed entries instead of failing the batch", async () => {
    const messy: LlmProvider = {
      parseCards: async () => ({ cards: [{ front: "x" }, { front: "รับผิดชอบ", back: "to take responsibility" }] }),
    };
    const cards = await parseWithLlm(chunk, META, messy);
    expect(cards).toHaveLength(1);
  });

  it("returns [] when provider throws (failure isolation, §6.3)", async () => {
    const broken: LlmProvider = { parseCards: async () => { throw new Error("api down"); } };
    await expect(parseWithLlm(chunk, META, broken)).resolves.toEqual([]);
  });
});
```

`packages/parsing/src/orchestrator.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "./orchestrator";
import type { LlmProvider, SourceMeta } from "./types";

describe("parse orchestrator", () => {
  it("routes sheets to tier-1 without touching the LLM", async () => {
    const raw = readFileSync(new URL("../test/fixtures/zh-sheet.csv", import.meta.url), "utf8");
    let llmCalled = false;
    const spy: LlmProvider = { parseCards: async () => { llmCalled = true; return { cards: [] }; } };
    const cards = await parse(raw, { type: "google_sheet", language: "zh" }, spy);
    expect(cards.length).toBeGreaterThan(0);
    expect(llmCalled).toBe(true); // 1 unparsed row ("confidence") escalates
    expect(cards.some((c) => c.front === "confidence")).toBe(false); // invalid front rejected
  });

  it("doc: tier-1 table + tier-2 sections merge into one list", async () => {
    const raw = readFileSync(new URL("../test/fixtures/th-doc-table.txt", import.meta.url), "utf8");
    const recorded = JSON.parse(readFileSync(new URL("../test/fixtures/th-doc-sections.llm-response.json", import.meta.url), "utf8"));
    const llm: LlmProvider = { parseCards: async () => recorded };
    const cards = await parse(raw, { type: "google_doc", language: "th" } satisfies SourceMeta, llm);
    expect(cards.some((c) => c.front === "ส่ง")).toBe(true);      // from tier 1
    expect(cards.some((c) => c.front === "รับผิดชอบ")).toBe(true); // from tier 2
  });

  it("without an llm provider, unparsed lines are dropped silently", async () => {
    const raw = readFileSync(new URL("../test/fixtures/th-doc-table.txt", import.meta.url), "utf8");
    const cards = await parse(raw, { type: "google_doc", language: "th" });
    expect(cards.some((c) => c.front === "ส่ง")).toBe(true);
    expect(cards.some((c) => c.front === "รับผิดชอบ")).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @schwanki/parsing test`
Expected: FAIL — missing modules.

- [ ] **Step 4: Implement**

`packages/parsing/src/prompts/parse-v1.ts`:
```ts
import type { SourceMeta } from "../types";

/**
 * Prompt v1 (2026-09-24). Versioned like code (§4.2): bump the filename on any change.
 * Rules baked in from spec §6.3: never correct teacher content; preserve the teacher's
 * own romanization; extract example sentences when present (§7.1 teacher examples first).
 */
export const PARSE_PROMPT_VERSION = "parse-v1";

export function PARSE_PROMPT_V1(meta: SourceMeta, chunk: string): string {
  return `You extract vocabulary flashcards from a language teacher's raw lesson notes.

Source language: ${meta.language}. The student's native language is English.

Rules:
- Output ONLY via the emit_cards tool.
- front = the word/phrase in ${meta.language} script, exactly as written (never fix typos).
- back = the English meaning, exactly as written (never fix typos like "arrrive").
- reading = pronunciation/romanization/pinyin if present, in the teacher's own notation.
- example = an example sentence from the notes if one exists, format "sentence — translation". Omit otherwise.
- confidence = 0.8 if the entry is unambiguous, lower if you guessed.
- Skip headers, dates, and section titles. Skip anything that is not vocabulary.

NOTES:
"""
${chunk}
"""`;
}
```

`packages/parsing/src/tier2-llm.ts`:
```ts
import { dedupKey } from "@schwanki/core";
import { validateLanguage } from "./language";
import { PARSE_PROMPT_V1 } from "./prompts/parse-v1";
import type { CandidateCard, LlmProvider, SourceMeta } from "./types";

/** Tier 2: LLM structured output for anything Tier 1 can't rule-parse (§6.2). */
export async function parseWithLlm(
  chunk: string,
  meta: SourceMeta,
  llm: LlmProvider,
): Promise<CandidateCard[]> {
  let raw: unknown;
  try {
    raw = await llm.parseCards(PARSE_PROMPT_V1(meta, chunk));
  } catch {
    return []; // failure isolation: a dead LLM never kills the sync (§6.3)
  }
  const list = (raw as { cards?: unknown })?.cards;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const out: CandidateCard[] = [];
  for (const item of list) {
    const c = item as Record<string, unknown>;
    if (typeof c.front !== "string" || typeof c.back !== "string" || !c.front.trim() || !c.back.trim()) continue;
    if (!validateLanguage(c.front, meta.language)) continue;
    const key = dedupKey(c.front, meta.language);
    if (seen.has(key)) continue;
    seen.add(key);
    const confidence = typeof c.confidence === "number" ? Math.min(c.confidence, 0.8) : 0.6;
    out.push({
      front: c.front.trim(),
      back: c.back.trim(),
      ...(typeof c.reading === "string" && c.reading.trim() ? { reading: c.reading.trim() } : {}),
      ...(typeof c.example === "string" && c.example.trim() ? { exampleSentence: c.example.trim() } : {}),
      rawContext: chunk,
      confidence,
      parseNotes: "tier2-llm",
    });
  }
  return out;
}
```

`packages/parsing/src/anthropic.ts`:
```ts
import type { LlmProvider } from "./types";

const CARDS_TOOL = {
  name: "emit_cards",
  description: "Emit extracted vocabulary cards",
  input_schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: { type: "string" },
            back: { type: "string" },
            reading: { type: "string" },
            example: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["front", "back"],
        },
      },
    },
    required: ["cards"],
  },
};

/** Raw-fetch Anthropic provider — zero deps, runs in Node 18+ and Deno alike. */
export function createAnthropicProvider(apiKey: string, model = "claude-haiku-4-5"): LlmProvider {
  return {
    async parseCards(prompt: string): Promise<unknown> {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0,
          tools: [CARDS_TOOL],
          tool_choice: { type: "tool", name: "emit_cards" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { content: Array<{ type: string; input?: unknown }> };
      const toolUse = body.content.find((b) => b.type === "tool_use");
      if (!toolUse) throw new Error("no tool_use block in response");
      return toolUse.input;
    },
  };
}
```

`packages/parsing/src/orchestrator.ts`:
```ts
import { dedupKey } from "@schwanki/core";
import { parseDocTable } from "./tier1-doc-table";
import { parseSheet } from "./tier1-sheet";
import { parseWithLlm } from "./tier2-llm";
import type { CandidateCard, LlmProvider, SourceMeta, TierResult } from "./types";

/**
 * Single entry point (§4.2): parse(rawContent, sourceMeta) → CandidateCard[].
 * Tier routing: sheets → table rules; docs → tab rules; everything else → LLM.
 * Tier-1 leftovers escalate to Tier 2 when a provider is available.
 */
export async function parse(
  rawContent: string,
  meta: SourceMeta,
  llm?: LlmProvider,
): Promise<CandidateCard[]> {
  let tier1: TierResult;
  if (meta.type === "google_sheet") tier1 = parseSheet(rawContent, meta);
  else if (meta.type === "google_doc") tier1 = parseDocTable(rawContent, meta);
  else tier1 = { cards: [], unparsed: rawContent.split(/\r?\n/).filter((l) => l.trim()) };

  let tier2Cards: CandidateCard[] = [];
  if (llm && tier1.unparsed.length > 0) {
    tier2Cards = await parseWithLlm(tier1.unparsed.join("\n"), meta, llm);
  }

  // Final cross-tier dedup (§6.3 within-batch layer)
  const seen = new Set(tier1.cards.map((c) => dedupKey(c.front, meta.language)));
  const dedupedTier2 = tier2Cards.filter((c) => {
    const key = dedupKey(c.front, meta.language);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...tier1.cards, ...dedupedTier2];
}
```

`packages/parsing/src/mod.ts`:
```ts
export * from "./types";
export * from "./language";
export * from "./csv";
export * from "./tier1-sheet";
export * from "./tier1-doc-table";
export * from "./tier2-llm";
export * from "./anthropic";
export * from "./orchestrator";
export * from "./prompts/parse-v1";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @schwanki/parsing test`
Expected: PASS — all golden fixtures + orchestrator tests green.

- [ ] **Step 6: Live smoke test against the real Anthropic API (manual, once)**

Requires `ANTHROPIC_API_KEY` in env. Run a scratch script (`packages/parsing/scripts/smoke.ts`, gitignore it or delete after):
```ts
import { readFileSync } from "node:fs";
import { parse, createAnthropicProvider } from "../src/mod";
const raw = readFileSync("test/fixtures/th-doc-table.txt", "utf8");
const cards = await parse(raw, { type: "google_doc", language: "th" }, createAnthropicProvider(process.env.ANTHROPIC_API_KEY!));
console.log(JSON.stringify(cards, null, 2));
```
Run: `cd packages/parsing && ANTHROPIC_API_KEY=... npx tsx scripts/smoke.ts`
Expected: output contains both `ส่ง` (tier 1) and `รับผิดชอบ` (tier 2) — proves the real model honors the schema. If Haiku's model id differs, update the default in `anthropic.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/parsing
git commit -m "feat(parsing): tier-2 LLM parser, anthropic provider, orchestrator"
```

---

### Task 10: Edge function `sync-google`

**Files:**
- Create: `supabase/functions/deno.json`, `supabase/functions/sync-google/index.ts`, `supabase/functions/sync-google/diff.ts`, `supabase/functions/sync-google/diff.test.ts`

**Interfaces:**
- Consumes: `sources`, `source_snapshots`, `user_google_tokens`, `llm_jobs` tables (Task 2).
- Produces:
  - `extractGoogleFileId(url: string): string | null` — parses `/d/<id>` from any Google Docs/Sheets URL.
  - `addedLines(oldContent: string | null, newContent: string): string[]` — trimmed, non-empty lines present in new but not old (append-mostly diff, §6.3).
  - Edge function endpoint: `POST /functions/v1/sync-google` with `{}` (sync all active google sources — cron path) or `{ "sourceId": "<uuid>" }` (manual "sync now" — must include user JWT; function verifies ownership).
  - On changed content: inserts one `llm_jobs` row `{ type: 'parse', payload: { source_id, chunk } }` where `chunk` = added lines joined by `\n`.

**Testing note:** edge functions are Deno; unit-testable pure logic (`diff.ts`, `extractGoogleFileId`) is tested with `deno test`. The HTTP handler is verified by manual invocation in Step 5.

- [ ] **Step 1: Write the failing tests**

`supabase/functions/deno.json` (shared import map for all functions):
```json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@^2.47.10",
    "ts-fsrs": "npm:ts-fsrs@^4.6.0",
    "@schwanki/parsing": "../../packages/parsing/src/mod.ts",
    "@schwanki/core": "../../packages/core/src/mod.ts"
  }
}
```

`supabase/functions/sync-google/diff.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert";
import { addedLines, extractGoogleFileId } from "./diff.ts";

Deno.test("extractGoogleFileId parses docs and sheets URLs", () => {
  assertEquals(
    extractGoogleFileId("https://docs.google.com/spreadsheets/d/1NvHzms9UKuxxWA5sH1mOYCS5YIuIGtpBC0L3LdyWcjg/edit?usp=sharing"),
    "1NvHzms9UKuxxWA5sH1mOYCS5YIuIGtpBC0L3LdyWcjg",
  );
  assertEquals(
    extractGoogleFileId("https://docs.google.com/document/d/1zyDnpi-l7Jh3SKvuCBTHT-isO-z2NjT_vq_I_0bqZCU/edit?tab=t.0"),
    "1zyDnpi-l7Jh3SKvuCBTHT-isO-z2NjT_vq_I_0bqZCU",
  );
  assertEquals(extractGoogleFileId("https://example.com"), null);
});

Deno.test("addedLines: first sync returns everything", () => {
  assertEquals(addedLines(null, "a\nb\n"), ["a", "b"]);
});

Deno.test("addedLines: append-only lesson diff returns just new lines", () => {
  const old = ",自信,confidence,zì xìn,\n,投资,invest,tóu zī,";
  const next = old + "\n,退休,retire,tuì xiū,";
  assertEquals(addedLines(old, next), [",退休,retire,tuì xiū,"]);
});

Deno.test("addedLines: ignores whitespace-only churn and blanks", () => {
  assertEquals(addedLines("a", "a \n\n b"), ["b"]);
});

Deno.test("addedLines: no change returns empty (free no-op sync)", () => {
  assertEquals(addedLines("a\nb", "a\nb"), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd supabase/functions && deno test sync-google/`
Expected: FAIL — `diff.ts` not found.

- [ ] **Step 3: Implement diff helpers**

`supabase/functions/sync-google/diff.ts`:
```ts
export function extractGoogleFileId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? null;
}

/**
 * Append-mostly diff (§3/§6.3): teachers add lines after each lesson.
 * Set-difference of normalized lines; order of new lines preserved.
 */
export function addedLines(oldContent: string | null, newContent: string): string[] {
  const norm = (s: string) =>
    s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const oldSet = new Set(oldContent ? norm(oldContent) : []);
  return norm(newContent).filter((l) => !oldSet.has(l));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test sync-google/`
Expected: PASS, 5 tests.

- [ ] **Step 5: Implement the handler**

`supabase/functions/sync-google/index.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import { addedLines, extractGoogleFileId } from "./diff.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_EXPORT = (fileId: string, mime: string) =>
  `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mime)}`;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function googleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new SyncError("revoked", `google token refresh failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

class SyncError extends Error {
  constructor(public kind: "revoked" | "error", message: string) { super(message); }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchContent(fileId: string, type: string, token: string): Promise<string> {
  const mime = type === "google_sheet" ? "text/csv" : "text/plain";
  const res = await fetch(DRIVE_EXPORT(fileId, mime), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw new SyncError("revoked", `drive export ${res.status}`);
  if (!res.ok) throw new SyncError("error", `drive export ${res.status}`);
  return res.text();
}

async function syncOne(source: Record<string, unknown>): Promise<string> {
  const supabase = adminClient();
  const fileId = extractGoogleFileId(source.external_ref as string);
  if (!fileId) throw new SyncError("error", "unparseable external_ref");

  const { data: tok } = await supabase
    .from("user_google_tokens").select("refresh_token")
    .eq("user_id", source.user_id).single();
  if (!tok) throw new SyncError("revoked", "no google refresh token stored");

  const access = await googleAccessToken(tok.refresh_token);
  const content = await fetchContent(fileId, source.type as string, access);
  const hash = await sha256(content);
  if (hash === source.content_hash) {
    await supabase.from("sources")
      .update({ last_synced_at: new Date().toISOString(), status: "active", error_detail: null })
      .eq("id", source.id);
    return "unchanged";
  }

  const { data: snap } = await supabase
    .from("source_snapshots").select("content")
    .eq("source_id", source.id).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  const added = addedLines(snap?.content ?? null, content);

  if (added.length > 0) {
    await supabase.from("llm_jobs").insert({
      type: "parse",
      payload: { source_id: source.id, chunk: added.join("\n") },
    });
  }
  await supabase.from("source_snapshots").insert({ source_id: source.id, content });
  await supabase.from("sources").update({
    last_synced_at: new Date().toISOString(), content_hash: hash, status: "active", error_detail: null,
  }).eq("id", source.id);
  return `diffed:${added.length}`;
}

Deno.serve(async (req) => {
  const supabase = adminClient();
  const body = await req.json().catch(() => ({})) as { sourceId?: string };

  let query = supabase.from("sources").select("*")
    .in("type", ["google_sheet", "google_doc"]).eq("status", "active");

  if (body.sourceId) {
    // Manual "sync now": verify the caller owns this source (§10 never silent, never cross-user)
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    query = query.eq("id", body.sourceId).eq("user_id", user.id);
  }

  const { data: sources } = await query;
  const results: Record<string, string> = {};
  for (const source of sources ?? []) {
    try {
      results[source.id] = await syncOne(source);
    } catch (e) {
      // Failure isolation (§6.3): mark this source, keep going
      const err = e as Error & { kind?: string };
      await supabase.from("sources").update({
        status: err.kind === "revoked" ? "revoked" : "error",
        error_detail: err.message,
      }).eq("id", source.id);
      results[source.id] = `failed:${err.message}`;
    }
  }
  return Response.json({ results });
});
```

- [ ] **Step 6: Wire secrets and verify manually against the real Sheet**

```bash
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...   # from Google Cloud console OAuth client
# local dev: put them in supabase/.env instead (gitignored)
supabase functions serve sync-google --env-file supabase/.env
```
Then with a test source row inserted (via SQL) pointing at the founder's real public Sheet:
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync-google \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "content-type: application/json" -d '{}'
```
Expected: `{"results":{"<id>":"diffed:670"}}` on first run (full import); second run: `"unchanged"`. Verify one row in `llm_jobs` with the chunk payload.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/deno.json supabase/functions/sync-google
git commit -m "feat(sync): sync-google edge function with line-diff incremental sync"
```

---

### Task 11: Edge function `parse-worker`

**Files:**
- Create: `supabase/functions/parse-worker/index.ts`

**Interfaces:**
- Consumes: `claim_llm_jobs()` (Task 2); `@schwanki/parsing` `parse()`, `createAnthropicProvider()` (Tasks 6–9); `candidate_cards`, `cards`, `sources` tables.
- Produces: `POST /functions/v1/parse-worker` — claims up to 10 pending `parse` jobs, parses each chunk, inserts `candidate_cards` with all three dedup layers (§6.3): within-batch (done by parsing), against pending candidates, against the deck (`cards_dedup_key` values loaded per user).

- [ ] **Step 1: Implement the handler**

`supabase/functions/parse-worker/index.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import { parse, createAnthropicProvider, type SourceMeta } from "@schwanki/parsing";
import { dedupKey } from "@schwanki/core";

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(async () => {
  const supabase = adminClient();
  const { data: jobs, error } = await supabase.rpc("claim_llm_jobs", { batch_size: 10 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const llm = apiKey
    ? createAnthropicProvider(apiKey, Deno.env.get("PARSE_MODEL") ?? "claude-haiku-4-5")
    : undefined;

  const done: string[] = [];
  const failed: string[] = [];

  for (const job of jobs ?? []) {
    try {
      const { source_id, chunk } = job.payload as { source_id: string; chunk: string };
      const { data: source } = await supabase.from("sources").select("*").eq("id", source_id).single();
      if (!source) throw new Error(`source ${source_id} gone`);

      const meta: SourceMeta = { type: source.type, language: source.language, externalRef: source.external_ref };
      const cards = await parse(chunk, meta, llm);

      // Dedup layer 2 & 3: against pending candidates and the deck (§6.3)
      const [{ data: pending }, { data: deck }] = await Promise.all([
        supabase.from("candidate_cards").select("front")
          .eq("source_id", source_id).eq("status", "pending"),
        supabase.from("cards").select("front, language").eq("user_id", source.user_id),
      ]);
      const existing = new Set([
        ...(pending ?? []).map((r) => dedupKey(r.front, source.language)),
        ...(deck ?? []).map((r) => dedupKey(r.front, r.language)),
      ]);
      const fresh = cards.filter((c) => !existing.has(dedupKey(c.front, meta.language)));

      if (fresh.length > 0) {
        const { error: insErr } = await supabase.from("candidate_cards").insert(
          fresh.map((c) => ({
            source_id,
            front: c.front, back: c.back,
            reading: c.reading ?? null, example_sentence: c.exampleSentence ?? null,
            raw_context: c.rawContext, confidence: c.confidence, parse_notes: c.parseNotes ?? null,
          })),
        );
        if (insErr) throw insErr;
      }

      await supabase.from("llm_jobs").update({ status: "done" }).eq("id", job.id);
      done.push(`${job.id}:${fresh.length}`);
    } catch (e) {
      const retryable = (job.attempts ?? 1) < 3;
      await supabase.from("llm_jobs").update({
        status: retryable ? "pending" : "failed",
        run_after: new Date(Date.now() + 5 * 60_000).toISOString(), // 5 min backoff
        last_error: (e as Error).message,
      }).eq("id", job.id);
      failed.push(`${job.id}:${(e as Error).message}`);
    }
  }
  return Response.json({ done, failed });
});
```

- [ ] **Step 2: Verify end-to-end locally**

With `supabase functions serve` running and the `llm_jobs` row from Task 10 Step 6 present:
```bash
ANTHROPIC_API_KEY=... supabase functions serve parse-worker --env-file supabase/.env
curl -X POST http://127.0.0.1:54321/functions/v1/parse-worker \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -d '{}'
```
Expected: `{"done":["<job-id>:NNN"],"failed":[]}`; `candidate_cards` now holds the parsed rows from the real Chinese sheet (~650 candidates after dedup), all `status='pending'`. Re-run with the same chunk re-inserted: dedup layers 2–3 yield `0` new candidates.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/parse-worker
git commit -m "feat(sync): parse-worker drains llm_jobs into triage inbox with 3-layer dedup"
```

---

### Task 12: Scheduled sync (pg_cron + pg_net)

**Files:**
- Create: `supabase/migrations/0002_cron.sql`

**Interfaces:**
- Consumes: deployed/edge function URLs for `sync-google`, `parse-worker`, `push-notify` (push-notify built in Task 17; schedule it here anyway — calls fail harmlessly until the function exists).
- Produces: cron jobs `sync-google-cron` (every 6 h), `parse-worker-cron` (every 10 min), `push-notify-cron` (hourly). Off-peak minutes per convention.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_cron.sql`:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Config rows seeded manually per environment (never commit keys):
--   insert into app_settings values ('functions_base_url', 'http://host.docker.internal:54321/functions/v1');
--   insert into app_settings values ('service_key', '<service_role_jwt>');
create table if not exists app_settings (key text primary key, value text not null);

create or replace function call_edge_function(fn_name text)
returns void language plpgsql security definer as $$
declare
  base text; key text;
begin
  select value into base from app_settings where key = 'functions_base_url';
  select value into key from app_settings where key = 'service_key';
  if base is null or key is null then
    raise warning 'app_settings missing functions_base_url/service_key; skipping %', fn_name;
    return;
  end if;
  perform net.http_post(
    url := base || '/' || fn_name,
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'content-type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;

-- Scheduled poll every 6 h (§6.1), off-peak minute
select cron.schedule('sync-google-cron', '17 */6 * * *', $$select call_edge_function('sync-google')$$);
-- Drain parse queue every 10 min
select cron.schedule('parse-worker-cron', '*/10 * * * *', $$select call_edge_function('parse-worker')$$);
-- Push reminders hourly (function arrives in Task 17)
select cron.schedule('push-notify-cron', '43 * * * *', $$select call_edge_function('push-notify')$$);
```

- [ ] **Step 2: Apply and verify jobs exist**

Run: `supabase db reset && supabase db shell -c "select jobname, schedule from cron.job;"`
Expected: three rows with the schedules above. Then seed `app_settings` locally and trigger once manually:
```sql
insert into app_settings values
  ('functions_base_url', 'http://host.docker.internal:54321/functions/v1'),
  ('service_key', '<local service_role key from supabase status>');
select call_edge_function('sync-google');
```
Expected: no error; `select * from net._http_response order by id desc limit 1;` shows a 200.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_cron.sql
git commit -m "feat(sync): pg_cron schedules for sync, parse, push"
```

---

### Task 13: Web app scaffold + Google auth

**Files:**
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.js`, `apps/web/src/index.css`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/lib/supabase.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth.test.ts`, `apps/web/src/pages/SignIn.tsx`

**Interfaces:**
- Consumes: `@schwanki/core` (`SchwankiApi`).
- Produces:
  - `supabase` client singleton (`src/lib/supabase.ts`) reading `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.
  - `signInWithGoogle(): Promise<void>` — OAuth with `drive.readonly` scope, `access_type: offline`, `prompt: consent`.
  - `captureGoogleTokens(): Promise<void>` — after OAuth redirect, upserts `session.provider_refresh_token` into `user_google_tokens` (RLS insert policy from Task 2 allows this).
  - Auth gate: unauthenticated users land on `SignIn`; authenticated users see the app shell.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/auth.test.ts` (pure logic — URL/scope construction):
```ts
import { describe, it, expect } from "vitest";
import { GOOGLE_OAUTH_OPTIONS } from "./auth";

describe("google oauth options", () => {
  it("requests drive.readonly with offline access and consent prompt", () => {
    expect(GOOGLE_OAUTH_OPTIONS.options.scopes).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(GOOGLE_OAUTH_OPTIONS.options.queryParams).toEqual({
      access_type: "offline",
      prompt: "consent",
    });
  });
});
```

- [ ] **Step 2: Scaffold the Vite app**

```bash
cd apps && pnpm create vite web --template react-ts && cd web
# rename the package so root scripts can filter it: set "name": "@schwanki/web" in apps/web/package.json
pnpm add "@schwanki/core@workspace:*" @supabase/supabase-js react-router-dom
pnpm add -D tailwindcss@^3.4 postcss autoprefixer vitest jsdom @testing-library/react
pnpm dlx tailwindcss init -p
```

`apps/web/package.json` — add scripts: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`. Add `"vitest": { "environment": "jsdom" }` via `vite.config.ts` test field.

`apps/web/vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom" },
});
```

`apps/web/tailwind.config.ts` — brand palette from spec §9.3 (goose system):
```ts
import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6EF",      // goose white / paper cream — surfaces
        ink: "#1C1A17",        // off-black leather — text, dark base
        beak: "#F26722",       // beak orange — CTAs, streaks, due badges
        acid: "#F5D90A",       // acid yellow — sparing highlights only
        mint: "#B8E0D2", lilac: "#D6C6E8", sky: "#A8D0E6", blush: "#F4C6D0", // deck tags only
      },
      fontFamily: { display: ["Archivo", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
```

`apps/web/src/index.css`:
```css
@tailwind base; @tailwind components; @tailwind utilities;
@import url("https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&display=swap");
body { @apply bg-cream text-ink font-display; }
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @schwanki/web test`
Expected: FAIL — `./auth` exports nothing / missing.

- [ ] **Step 4: Implement auth + shell**

`apps/web/src/lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import { SchwankiApi } from "@schwanki/core";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);
export const api = new SchwankiApi(supabase);
```

`apps/web/src/lib/auth.ts`:
```ts
import { supabase } from "./supabase";

export const GOOGLE_OAUTH_OPTIONS = {
  provider: "google" as const,
  options: {
    scopes: "openid email profile https://www.googleapis.com/auth/drive.readonly",
    queryParams: { access_type: "offline", prompt: "consent" },
    redirectTo: window.location.origin,
  },
};

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth(GOOGLE_OAUTH_OPTIONS);
  if (error) throw error;
}

/** Right after OAuth redirect, stash the Google refresh token for server-side sync (§6.1). */
export async function captureGoogleTokens(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const refresh = session?.provider_refresh_token;
  const userId = session?.user.id;
  if (!refresh || !userId) return;
  await supabase.from("user_google_tokens").upsert({
    user_id: userId, refresh_token: refresh, updated_at: new Date().toISOString(),
  });
}
```

`apps/web/src/pages/SignIn.tsx` (goose voice, mascot asset from `inspiration/mascot/concept-2-chaos-goose.png` copied to `apps/web/public/goose.png`):
```tsx
import { signInWithGoogle } from "@/lib/auth";

export default function SignIn() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-sm text-center space-y-6">
        <img src="/goose.png" alt="The Schwanki goose" className="w-40 mx-auto" />
        <h1 className="text-5xl font-black tracking-tight">Schwanki</h1>
        <p className="text-lg">Your teachers write the words down. I make sure you actually learn them. — 🪿</p>
        <button
          onClick={() => void signInWithGoogle()}
          className="w-full rounded-2xl bg-beak px-6 py-4 text-xl font-bold text-cream shadow-lg hover:scale-[1.02] transition"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
```

`apps/web/src/App.tsx` — auth gate + routes (pages built in later tasks; stubs return `<div/>` for now and get replaced):
```tsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { captureGoogleTokens } from "@/lib/auth";
import SignIn from "@/pages/SignIn";
import Sources from "@/pages/Sources";
import Triage from "@/pages/Triage";
import Review from "@/pages/Review";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) void captureGoogleTokens();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Review />} />
        <Route path="/inbox" element={<Triage />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
```

Temporary stubs `apps/web/src/pages/{Sources,Triage,Review}.tsx`:
```tsx
export default function Page() { return <div className="p-6">coming online soon</div>; }
```

`apps/web/index.html`: standard Vite shell with `<title>Schwanki</title>` and `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

- [ ] **Step 5: Verify — test passes, app boots, real Google sign-in works**

Run: `pnpm --filter @schwanki/web test && pnpm dev`
Expected: test PASS; browser at the printed localhost URL shows the goose sign-in screen; clicking through Google OAuth returns to the app (stub pages). Verify in Supabase: `select user_id from user_google_tokens;` shows a row. If `provider_refresh_token` is null, the Google Cloud OAuth consent screen is missing the `drive.readonly` scope — fix there, re-auth.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): vite react scaffold, goose sign-in, google token capture"
```

---

### Task 14: Sources UI (connect + status + sync-now)

**Files:**
- Create: `apps/web/src/pages/Sources.tsx` (replace stub), `apps/web/src/components/SourceForm.tsx`, `apps/web/src/lib/detectSource.test.ts`, `apps/web/src/lib/detectSource.ts`

**Interfaces:**
- Consumes: `api.listSources()`, `api.addSource()` (Task 5); `sync-google` edge function (Task 10).
- Produces:
  - `detectSourceType(url: string): 'google_sheet' | 'google_doc' | null` — `/spreadsheets/` → sheet, `/document/` → doc.
  - `Sources` page: list with status badges (`active` cream/ink, `error` acid, `revoked` beak outline), error copy from `error_detail`, "Sync now" button calling the edge function with the user's JWT, add form (URL paste → type auto-detected → label + language fields).

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/detectSource.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectSourceType } from "./detectSource";

describe("detectSourceType", () => {
  it("detects sheets", () => {
    expect(detectSourceType("https://docs.google.com/spreadsheets/d/1NvH/edit?usp=sharing")).toBe("google_sheet");
  });
  it("detects docs", () => {
    expect(detectSourceType("https://docs.google.com/document/d/1zyD/edit?tab=t.0")).toBe("google_doc");
  });
  it("rejects anything else", () => {
    expect(detectSourceType("https://canva.com/design/x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/web test` → FAIL (`./detectSource` missing).

- [ ] **Step 3: Implement**

`apps/web/src/lib/detectSource.ts`:
```ts
import type { SourceType } from "@schwanki/core";

export function detectSourceType(url: string): Extract<SourceType, "google_sheet" | "google_doc"> | null {
  if (/docs\.google\.com\/spreadsheets\//.test(url)) return "google_sheet";
  if (/docs\.google\.com\/document\//.test(url)) return "google_doc";
  return null;
}
```

`apps/web/src/components/SourceForm.tsx`:
```tsx
import { useState } from "react";
import { api } from "@/lib/supabase";
import { detectSourceType } from "@/lib/detectSource";

const LANGS = [
  ["zh", "Chinese"], ["th", "Thai"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["ja", "Japanese"], ["ko", "Korean"], ["en", "English"],
] as const;

export function SourceForm({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState<string>("zh");
  const [error, setError] = useState<string | null>(null);
  const type = detectSourceType(url);

  async function submit() {
    if (!type) { setError("That's not a Google Doc or Sheet link. The goose is unimpressed."); return; }
    try {
      await api.addSource({ type, externalRef: url, label: label || "Untitled source", language });
      setUrl(""); setLabel(""); setError(null);
      onAdded();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-3">
      <input value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a Google Doc or Sheet link"
        className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
      {type && <p className="text-sm">Detected: {type === "google_sheet" ? "📊 Sheet" : "📄 Doc"}</p>}
      <div className="flex gap-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Preply — Kru May)"
          className="flex-1 rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="rounded-xl border border-ink/20 bg-cream px-3 py-3">
          {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-beak">{error}</p>}
      <button onClick={() => void submit()}
        className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-cream hover:bg-beak transition">
        Connect source
      </button>
    </div>
  );
}
```

`apps/web/src/pages/Sources.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import type { Source } from "@schwanki/core";
import { api, supabase } from "@/lib/supabase";
import { SourceForm } from "@/components/SourceForm";

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const load = useCallback(async () => setSources(await api.listSources()), []);
  useEffect(() => { void load(); }, [load]);

  async function syncNow(id: string) {
    setSyncing(id);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("sync-google", {
      body: { sourceId: id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    await load();
    setSyncing(null);
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-3xl font-black">Sources</h1>
      <SourceForm onAdded={load} />
      <ul className="space-y-3">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
            <div>
              <p className="font-bold">{s.label} <span className="text-sm font-normal">({s.language})</span></p>
              <p className="text-sm text-ink/60">
                {s.status === "active" && (s.lastSyncedAt ? `Synced ${new Date(s.lastSyncedAt).toLocaleString()}` : "Never synced")}
                {s.status === "error" && `Sheet sync failed: ${s.errorDetail ?? "unknown"} — try again`}
                {s.status === "revoked" && "Permission revoked — reconnect Google on the sign-in screen"}
              </p>
            </div>
            <button onClick={() => void syncNow(s.id)} disabled={syncing === s.id}
              className="rounded-xl bg-beak px-4 py-2 font-bold text-cream disabled:opacity-50">
              {syncing === s.id ? "Syncing…" : "Sync now"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @schwanki/web test && pnpm --filter @schwanki/web typecheck && pnpm dev`
Expected: tests pass; adding the founder's real Sheet URL creates a row; "Sync now" flips `last_synced_at` (check Network tab → 200 from `sync-google`, then the Sources page updates). Within ~10 min (or after manually invoking parse-worker) candidates exist.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): sources page with add form, status badges, sync-now"
```

---

### Task 15: Triage inbox UI

**Files:**
- Create: `apps/web/src/pages/Triage.tsx` (replace stub), `apps/web/src/components/CandidateRow.tsx`, `apps/web/src/lib/groupCandidates.ts`, `apps/web/src/lib/groupCandidates.test.ts`

**Interfaces:**
- Consumes: `api.listPendingCandidates()`, `api.approveCandidate()`, `api.setCandidateStatus()` (Task 5).
- Produces:
  - `groupByBatch(candidates: CandidateCardRow[]): Array<{ key: string; label: string; items: CandidateCardRow[] }>` — groups by `sourceId + created_at date` (append-mostly lesson batches, §9.1), newest batch first.
  - Triage page: batches as cards; per-candidate approve ✓ / discard ✕ / inline edit (front/back/reading); "Approve all (N)" per batch; already confidence-sorted by the API (sketchy first, §5).

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/groupCandidates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { groupByBatch } from "./groupCandidates";
import type { CandidateCardRow } from "@schwanki/core";

function mk(id: string, sourceId: string, createdAt: string): CandidateCardRow {
  return { id, sourceId, front: id, back: "b", rawContext: "", status: "pending", confidence: 0.9, createdAt };
}

describe("groupByBatch", () => {
  it("groups by source + calendar date, newest first", () => {
    const groups = groupByBatch([
      mk("a", "s1", "2026-09-16T10:00:00Z"),
      mk("b", "s1", "2026-09-16T11:00:00Z"),
      mk("c", "s1", "2026-09-23T09:00:00Z"),
      mk("d", "s2", "2026-09-23T09:00:00Z"),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["c"]); // newest first
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["d"]); // different source = different batch
    expect(groups[2]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/web test` → FAIL.

- [ ] **Step 3: Implement grouping + UI**

`apps/web/src/lib/groupCandidates.ts`:
```ts
import type { CandidateCardRow } from "@schwanki/core";

export interface Batch { key: string; label: string; sourceId: string; items: CandidateCardRow[] }

export function groupByBatch(candidates: CandidateCardRow[]): Batch[] {
  const map = new Map<string, Batch>();
  for (const c of candidates) {
    const day = c.createdAt.slice(0, 10);
    const key = `${c.sourceId}:${day}`;
    const batch = map.get(key) ?? { key, label: day, sourceId: c.sourceId, items: [] };
    batch.items.push(c);
    map.set(key, batch);
  }
  return [...map.values()].sort((a, b) => b.label.localeCompare(a.label));
}
```

`apps/web/src/components/CandidateRow.tsx`:
```tsx
import { useState } from "react";
import type { CandidateCardRow } from "@schwanki/core";

export function CandidateRow(props: {
  candidate: CandidateCardRow;
  onApprove: (edited?: { front: string; back: string; reading?: string }) => void;
  onDiscard: () => void;
}) {
  const { candidate: c } = props;
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(c.front);
  const [back, setBack] = useState(c.back);
  const [reading, setReading] = useState(c.reading ?? "");

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl bg-cream p-3">
        <input value={front} onChange={(e) => setFront(e.target.value)} className="w-full rounded border px-2 py-1 text-lg font-bold" />
        <input value={reading} onChange={(e) => setReading(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" placeholder="reading" />
        <input value={back} onChange={(e) => setBack(e.target.value)} className="w-full rounded border px-2 py-1" />
        <div className="flex gap-2">
          <button onClick={() => props.onApprove({ front, back, ...(reading ? { reading } : {}) })}
            className="rounded bg-beak px-3 py-1 font-bold text-cream">Save & approve</button>
          <button onClick={() => setEditing(false)} className="rounded px-3 py-1">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-cream p-3">
      <button onClick={props.onApprove} aria-label="approve"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-beak font-black text-cream">✓</button>
      <button onClick={props.onDiscard} aria-label="discard"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink/20 font-black">✕</button>
      <button onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-lg font-bold">{c.front}
          {c.reading && <span className="ml-2 text-sm font-normal text-ink/60">{c.reading}</span>}
        </span>
        <span className="block truncate text-sm text-ink/70">{c.back}</span>
        {c.confidence < 0.7 && <span className="text-xs text-beak">⚠ goose isn't sure about this one{c.parseNotes ? `: ${c.parseNotes}` : ""}</span>}
      </button>
    </div>
  );
}
```

`apps/web/src/pages/Triage.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import type { CandidateCardRow } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { groupByBatch, type Batch } from "@/lib/groupCandidates";
import { CandidateRow } from "@/components/CandidateRow";

export default function Triage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const load = useCallback(async () => setBatches(groupByBatch(await api.listPendingCandidates())), []);
  useEffect(() => { void load(); }, [load]);

  async function approve(c: CandidateCardRow, edited?: { front: string; back: string; reading?: string }) {
    const effective = edited ? { ...c, ...edited } : c;
    await api.approveCandidate(effective);
    await load();
  }
  async function discard(c: CandidateCardRow) { await api.setCandidateStatus(c.id, "discarded"); await load(); }
  async function approveAll(batch: Batch) {
    for (const c of batch.items) await api.approveCandidate(c);
    await load();
  }

  if (batches.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center space-y-4 pt-24">
        <img src="/goose.png" alt="" className="mx-auto w-32" />
        <p className="text-xl font-bold">Inbox zero. The goose has nothing to judge you for. Yet.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-8">
      <h1 className="text-3xl font-black">Fresh loot</h1>
      {batches.map((b) => (
        <section key={b.key} className="space-y-3 rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
          <header className="flex items-center justify-between">
            <h2 className="font-bold">{b.label} · {b.items.length} words</h2>
            <button onClick={() => void approveAll(b)}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-beak">
              Approve all ({b.items.length})
            </button>
          </header>
          {b.items.map((c) => (
            <CandidateRow key={c.id} candidate={c}
              onApprove={(edited) => void approve(c, edited)}
              onDiscard={() => void discard(c)} />
          ))}
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @schwanki/web test && pnpm dev`
Expected: groupByBatch tests pass; `/inbox` shows the real sheet's candidates grouped by sync date, sketchy (low-confidence, fused-pinyin) rows flagged; approving a row moves it to `cards` (check Supabase table editor), discarding sets status; duplicate fronts approve as `'duplicate'` → auto-discarded without error.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): triage inbox with lesson batches, edit, approve-all"
```

---

### Task 16: Review session UI (the core loop)

**Files:**
- Create: `apps/web/src/pages/Review.tsx` (replace stub), `apps/web/src/components/ReviewCard.tsx`, `apps/web/src/components/StreakScreen.tsx`

**Interfaces:**
- Consumes: `api.listDueCards()`, `api.saveReview()`, `buildSessionQueue()`, `applyReview()` (Task 5); `ReviewRating`.
- Produces: `/` route — opens straight into the session (§9.1): front + reading → tap to flip → back + example → four rating buttons (keys 1–4). Empty deck → mascot empty state. Session end → `StreakScreen` (count from consecutive `review_events` days — computed in-page via a `review_events` count query).

- [ ] **Step 1: Implement (UI task — logic already unit-tested in `core`)**

`apps/web/src/components/ReviewCard.tsx`:
```tsx
import { useEffect, useState } from "react";
import type { DueCard, ReviewRating } from "@schwanki/core";

const RATINGS: Array<[ReviewRating, string, string]> = [
  ["again", "1", "Forgot"],
  ["hard", "2", "Hard"],
  ["good", "3", "Got it"],
  ["easy", "4", "Too easy"],
];

export function ReviewCard({ due, onRate }: { due: DueCard; onRate: (r: ReviewRating) => void }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!flipped && (e.key === " " || e.key === "Enter")) setFlipped(true);
      const hit = RATINGS.find(([, k]) => k === e.key);
      if (flipped && hit) onRate(hit[0]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, onRate]);

  return (
    <div className="space-y-6">
      <button onClick={() => setFlipped(true)}
        className="block w-full rounded-3xl border-2 border-ink/10 bg-white/70 p-10 text-center shadow-sm">
        <p className="text-5xl font-black tracking-tight">{due.card.front}</p>
        {due.card.reading && <p className="mt-2 text-xl text-ink/60">{due.card.reading}</p>}
        {flipped && (
          <div className="mt-6 border-t-2 border-dashed border-ink/10 pt-6">
            <p className="text-2xl font-bold">{due.card.back}</p>
            {due.card.exampleSentence && <p className="mt-3 text-ink/70">{due.card.exampleSentence}</p>}
          </div>
        )}
        {!flipped && <p className="mt-8 text-sm text-ink/40">tap to flip</p>}
      </button>
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map(([r, key, label]) => (
            <button key={r} onClick={() => onRate(r)}
              className={`rounded-xl px-2 py-3 font-bold transition hover:scale-105 ${r === "again" ? "bg-ink text-cream" : r === "good" ? "bg-beak text-cream" : "border-2 border-ink/15"}`}>
              {label}<span className="block text-xs font-normal opacity-60">{key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

`apps/web/src/pages/Review.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { applyReview, buildSessionQueue, type DueCard, type ReviewRating } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { ReviewCard } from "@/components/ReviewCard";
import { StreakScreen } from "@/components/StreakScreen";

export default function Review() {
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [done, setDone] = useState(0);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    const due = await api.listDueCards(new Date());
    setQueue(buildSessionQueue(due, new Date()));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function rate(rating: ReviewRating) {
    if (!queue || queue.length === 0) return;
    const current = queue[0]!;
    const elapsedMs = Date.now() - shownAt.current;
    const { state, event } = applyReview(current, rating, new Date());
    await api.saveReview(state, { ...event, elapsedMs });
    setDone((d) => d + 1);
    shownAt.current = Date.now();
    if (rating === "again") {
      // relearn soon: push to back of session
      setQueue((q) => q ? [...q.slice(1), current] : q);
    } else {
      setQueue((q) => q?.slice(1) ?? []);
    }
  }

  if (queue === null) return <main className="p-6 text-center pt-24">Shuffling the notebook…</main>;
  if (queue.length === 0) {
    return (
      <main className="mx-auto max-w-xl p-6 pt-16">
        {done > 0 ? <StreakScreen reviewed={done} /> : (
          <div className="text-center space-y-4">
            <img src="/goose.png" alt="" className="mx-auto w-32" />
            <p className="text-xl font-bold">Nothing due. The goose nods, once, approvingly.</p>
            <a href="/inbox" className="inline-block rounded-xl bg-beak px-6 py-3 font-bold text-cream">Check the inbox</a>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6 pt-10">
      <p className="mb-4 text-sm font-bold text-ink/50">{queue.length} to go · {done} done</p>
      <ReviewCard key={queue[0]!.card.id + queue.length} due={queue[0]!} onRate={(r) => void rate(r)} />
    </main>
  );
}
```

`apps/web/src/components/StreakScreen.tsx`:
```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function StreakScreen({ reviewed }: { reviewed: number }) {
  const [streak, setStreak] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("review_events").select("reviewed_at")
        .eq("user_id", user!.id).order("reviewed_at", { ascending: false }).limit(500);
      const days = new Set((data ?? []).map((r) => (r.reviewed_at as string).slice(0, 10)));
      let n = 0;
      const cursor = new Date();
      if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
      while (days.has(cursor.toISOString().slice(0, 10))) { n++; cursor.setDate(cursor.getDate() - 1); }
      setStreak(n);
    })();
  }, []);
  return (
    <div className="text-center space-y-4">
      <img src="/goose.png" alt="" className="mx-auto w-32" />
      <p className="text-5xl font-black text-beak">{streak ?? "…"}-day streak</p>
      <p className="text-lg">{reviewed} cards. {streak && streak >= 7 ? "The goose is genuinely impressed. Don't ruin it." : "Cute. The notebook is still mostly unread."}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually end-to-end**

Run: `pnpm dev`, approve some candidates in `/inbox`, open `/`.
Expected: approved cards appear immediately (new cards due now); flip works; rating "good" removes the card and writes one `review_events` row + updates `card_state.due_at` into the future (check table editor); rating "again" re-appends the card to the session; keyboard 1–4 works; finishing shows the streak screen with correct count.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web): FSRS review session with flip UI, ratings, streak screen"
```

---

### Task 17: Push notifications

**Files:**
- Create: `supabase/functions/push-notify/index.ts`
- Create: `apps/web/src/lib/push.ts`, `apps/web/src/components/NotificationPrime.tsx`
- Modify: `apps/web/src/App.tsx` (mount `<NotificationPrime/>` after sign-in), `apps/web/vite.config.ts` (register SW — finalized in Task 18)

**Interfaces:**
- Consumes: `push_subscriptions` table (Task 2); VAPID key pair (generated in Step 1).
- Produces:
  - `subscribePush(remindHour: number): Promise<void>` — requests permission, subscribes via SW registration, upserts `push_subscriptions`.
  - Edge function `push-notify`: hourly (Task 12 cron); sends to subs whose `remind_hour` == current hour in their `tz`; deletes subs that 410.
  - `NotificationPrime` — mascot sells the reminder BEFORE the OS dialog (§9.3 Duolingo pattern).

- [ ] **Step 1: Generate VAPID keys and set secrets**

```bash
npx web-push generate-vapid-keys
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
# local: supabase/.env
# also: echo VITE_VAPID_PUBLIC_KEY=... >> apps/web/.env
```

- [ ] **Step 2: Implement the edge function**

`supabase/functions/push-notify/index.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import webpush from "npm:web-push@^3.6.7";

webpush.setVapidDetails(
  "mailto:honk@schwanki.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

// Goose voice, rotating by day (docs/brand/copy.md: smug, not angry)
const LINES = [
  "Your teacher wrote down words this week. I've seen them. You haven't.",
  "Cards are due. The notebook doesn't read itself.",
  "Five minutes. That's all I'm asking. — 🪿",
  "Streaks die quietly. Open the app.",
];

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  let sent = 0; const dead: string[] = [];

  for (const sub of subs ?? []) {
    const localHour = parseInt(
      new Date().toLocaleString("en-US", { timeZone: sub.tz, hour: "2-digit", hourCycle: "h23" }), 10,
    );
    if (localHour !== sub.remind_hour) continue;

    // Skip users with nothing due — check card_state
    const { count } = await supabase.from("card_state")
      .select("*", { count: "exact", head: true })
      .eq("user_id", sub.user_id).lte("due_at", new Date().toISOString());
    if (!count) continue;

    const body = LINES[new Date().getDate() % LINES.length]!;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
        JSON.stringify({ title: `${count} cards are waiting`, body }),
      );
      sent++;
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 410) dead.push(sub.id);
    }
  }
  if (dead.length) await supabase.from("push_subscriptions").delete().in("id", dead);
  return Response.json({ sent, pruned: dead.length });
});
```

If `npm:web-push` breaks under Deno at runtime, swap in `@negrel/webpush` (Deno-native) behind the same `sendNotification` call — the handler logic doesn't change.

- [ ] **Step 3: Client-side subscribe + priming screen**

`apps/web/src/lib/push.ts`:
```ts
import { supabase } from "./supabase";

export async function subscribePush(remindHour: number): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY as string,
  });
  const json = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
    remind_hour: remindHour,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }, { onConflict: "endpoint" });
  return !error;
}
```

`apps/web/src/components/NotificationPrime.tsx`:
```tsx
import { useState } from "react";
import { subscribePush } from "@/lib/push";

/** Mascot sells the reminder BEFORE the OS dialog (§9.3). Shown once per device. */
export function NotificationPrime() {
  const [hour, setHour] = useState(9);
  const [done, setDone] = useState(() => localStorage.getItem("pushPrimed") === "1");
  if (done) return null;

  async function enable() {
    const ok = await subscribePush(hour);
    localStorage.setItem("pushPrimed", "1");
    setDone(true);
    if (!ok) alert("Notifications blocked. The goose will remember this.");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl p-4">
      <div className="flex items-center gap-4 rounded-3xl border-2 border-ink/10 bg-ink p-5 text-cream shadow-2xl">
        <img src="/goose.png" alt="" className="w-16" />
        <div className="flex-1">
          <p className="font-bold">I'll nag you daily. It's literally my whole job.</p>
          <div className="mt-2 flex items-center gap-2">
            <select value={hour} onChange={(e) => setHour(+e.target.value)}
              className="rounded-lg bg-cream px-2 py-1 text-ink">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
            <button onClick={() => void enable()} className="rounded-lg bg-beak px-4 py-1 font-bold">Enable</button>
            <button onClick={() => { localStorage.setItem("pushPrimed", "1"); setDone(true); }}
              className="text-sm text-cream/60">no thanks</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Mount inside `App.tsx` after the auth gate: `{session && <NotificationPrime />}` above `<Routes>`.

- [ ] **Step 4: Verify**

Run `pnpm dev` over `localhost` (push works on localhost), enable at current hour + 1... faster: set `remind_hour` to the upcoming hour, invoke `push-notify` manually:
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/push-notify -H "Authorization: Bearer $SERVICE_ROLE_KEY" -d '{}'
```
Expected: `{"sent":1,"pruned":0}` and a real notification appears. (Requires Task 18's service worker registered first — implement Task 18 before this verification if the SW doesn't exist yet.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/push-notify apps/web
git commit -m "feat(push): web-push reminders with goose priming screen"
```

---

### Task 18: PWA installability + offline review cache

**Files:**
- Create: `apps/web/public/manifest.webmanifest`, `apps/web/src/offline/db.ts`, `apps/web/src/offline/types.ts`, `apps/web/src/offline/dueCache.ts`, `apps/web/src/offline/dueCache.test.ts`, `apps/web/src/offline/outbox.ts`, `apps/web/src/offline/outbox.test.ts`, `apps/web/src/sw.ts`
- Modify: `apps/web/vite.config.ts`, `apps/web/src/pages/Review.tsx` (offline fallback path)

**Interfaces:**
- Consumes: `api.listDueCards()`, `api.saveReview()`; `DueCard`, `CardState`.
- Produces:
  - vite-plugin-pwa with `injectManifest`, custom `src/sw.ts` (app-shell precache + push event handler).
  - `cacheDueCards(cards: DueCard[]): Promise<void>` / `loadCachedDueCards(): Promise<DueCard[]>` (idb, store `due`).
  - `queueReview(payload: QueuedReview): Promise<void>` / `flushOutbox(api: SchwankiApi): Promise<number>` (idb, store `outbox`; returns count flushed).
  - `type QueuedReview = { state: CardState; event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard; elapsedMs?: number } }`.
  - Review page: on `listDueCards` failure (offline) → `loadCachedDueCards()`; on `saveReview` failure → `queueReview`; on `window.online` → `flushOutbox`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/offline/dueCache.test.ts` and `outbox.test.ts` use `fake-indexeddb` (`pnpm add -D fake-indexeddb idb`):
```ts
// outbox.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { queueReview, flushOutbox } from "./outbox";
import type { QueuedReview } from "./types";

const ITEM: QueuedReview = {
  state: { cardId: "c1", dueAt: "2026-09-25T10:00:00Z", stability: 1, difficulty: 5, reps: 1, lapses: 0, fsrs: {} },
  event: { cardId: "c1", rating: "good", reviewedAt: "2026-09-24T10:00:00Z", fsrsStateBefore: {} },
};

describe("review outbox", () => {
  beforeEach(async () => indexedDB.deleteDatabase("schwanki-offline"));

  it("queues offline reviews and flushes them in order", async () => {
    await queueReview(ITEM);
    await queueReview({ ...ITEM, state: { ...ITEM.state, cardId: "c2" }, event: { ...ITEM.event, cardId: "c2" } });
    const saved: string[] = [];
    const fakeApi = { saveReview: async (s: { cardId: string }) => { saved.push(s.cardId); } };
    const flushed = await flushOutbox(fakeApi as never);
    expect(flushed).toBe(2);
    expect(saved).toEqual(["c1", "c2"]);
  });

  it("stops flushing on first failure (keeps remaining queued)", async () => {
    await queueReview(ITEM);
    await queueReview({ ...ITEM, state: { ...ITEM.state, cardId: "c2" }, event: { ...ITEM.event, cardId: "c2" } });
    let calls = 0;
    const fakeApi = { saveReview: async () => { calls++; if (calls === 1) throw new Error("offline"); } };
    const flushed = await flushOutbox(fakeApi as never);
    expect(flushed).toBe(0);
    // both still queued: a working api flushes 2
    const okApi = { saveReview: async () => {} };
    expect(await flushOutbox(okApi as never)).toBe(2);
  });
});
```

`apps/web/src/offline/types.ts`:
```ts
import type { CardState, ReviewRating, SerializedFsrsCard } from "@schwanki/core";
export interface QueuedReview {
  state: CardState;
  event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard; elapsedMs?: number };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @schwanki/web test` → FAIL (missing modules).

- [ ] **Step 3: Implement offline modules**

`apps/web/src/offline/db.ts`:
```ts
import { openDB, type IDBPDatabase } from "idb";

export function db(): Promise<IDBPDatabase> {
  return openDB("schwanki-offline", 1, {
    upgrade(d) {
      d.createObjectStore("due", { keyPath: "card.id" });
      d.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
    },
  });
}
```

`apps/web/src/offline/dueCache.ts`:
```ts
import type { DueCard } from "@schwanki/core";
import { db } from "./db";

export async function cacheDueCards(cards: DueCard[]): Promise<void> {
  const d = await db();
  const tx = d.transaction("due", "readwrite");
  await tx.store.clear();
  for (const c of cards) await tx.store.put(c);
  await tx.done;
}

export async function loadCachedDueCards(): Promise<DueCard[]> {
  return (await (await db()).getAll("due")) as DueCard[];
}
```

`apps/web/src/offline/outbox.ts`:
```ts
import { db } from "./db";
import type { QueuedReview } from "./types";

export async function queueReview(payload: QueuedReview): Promise<void> {
  await (await db()).add("outbox", payload);
}

interface ReviewSaver { saveReview: (state: QueuedReview["state"], event: QueuedReview["event"]) => Promise<void> }

/** Flush in FIFO order; stop at first failure so nothing is lost or reordered. Returns count flushed. */
export async function flushOutbox(api: ReviewSaver): Promise<number> {
  const d = await db();
  let flushed = 0;
  while (true) {
    const tx = d.transaction("outbox", "readwrite");
    const cursor = await tx.store.openCursor();
    if (!cursor) { await tx.done; break; }
    const item = cursor.value as QueuedReview;
    try {
      await api.saveReview(item.state, item.event);
    } catch {
      await tx.done;
      break;
    }
    await cursor.delete();
    await tx.done;
    flushed++;
  }
  return flushed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @schwanki/web test`
Expected: PASS, 2 outbox tests.

- [ ] **Step 5: PWA manifest + service worker**

`apps/web/public/manifest.webmanifest`:
```json
{
  "name": "Schwanki",
  "short_name": "Schwanki",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAF6EF",
  "theme_color": "#1C1A17",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```
Icons: render `public/goose.png` onto 192/512 cream-background PNGs (any image tool; the goose PNG is transparent so composite over `#FAF6EF`).

`pnpm add -D vite-plugin-pwa workbox-precaching workbox-routing` then `apps/web/vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      manifest: false, // using public/manifest.webmanifest
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom" },
});
```

`apps/web/src/sw.ts`:
```ts
/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  const data = event.data?.json() as { title: string; body: string };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
```

Link the manifest in `index.html`: `<link rel="manifest" href="/manifest.webmanifest">` + `<meta name="theme-color" content="#1C1A17">` + apple-touch-icon.

- [ ] **Step 6: Wire offline into the Review page**

In `apps/web/src/pages/Review.tsx`, replace the `load` and `rate` bodies:
```ts
const load = useCallback(async () => {
  try {
    const due = await api.listDueCards(new Date());
    await cacheDueCards(due);
    setQueue(buildSessionQueue(due, new Date()));
  } catch {
    const cached = await loadCachedDueCards();
    setQueue(buildSessionQueue(cached, new Date()));
  }
}, []);
```
and in `rate()`:
```ts
try {
  await api.saveReview(state, { ...event, elapsedMs });
} catch {
  await queueReview({ state, event: { ...event, elapsedMs } });
}
```
plus at the top of the component:
```ts
useEffect(() => {
  const flush = () => void flushOutbox(api);
  window.addEventListener("online", flush);
  void flushOutbox(api); // flush on mount too
  return () => window.removeEventListener("online", flush);
}, []);
```
Imports: `import { cacheDueCards, loadCachedDueCards } from "@/offline/dueCache"; import { queueReview, flushOutbox } from "@/offline/outbox";`.

- [ ] **Step 7: Verify installability + offline**

Run: `pnpm --filter @schwanki/web build && pnpm --filter @schwanki/web preview`
Expected: Lighthouse/devtools "Installability" clean; install prompt on desktop Chrome; DevTools → Network → Offline → reload → due cards still review from cache; rate a card offline (goes to outbox), go back online → `card_state`/`review_events` updated without duplicates.

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): PWA install, service worker push, offline due cache + review outbox"
```

---

## Phase 1 definition of done

1. `pnpm -r test` green; `deno test` green in `supabase/functions`; `pnpm -r typecheck` green.
2. Founder's real Chinese Sheet connected → first sync imports ~650 candidates → triage → approve → review on phone PWA installed to home screen.
3. Thai Doc connected → table rows tier-1, section rows tier-2, `arrrive` typo survives into triage verbatim.
4. Cron fires (`select * from cron.job_run_details order by start_time desc limit 5;` shows 200s).
5. Push reminder arrives at chosen hour on the phone.
6. Dogfood gate (§11): founder reviews daily for 2 straight weeks.
