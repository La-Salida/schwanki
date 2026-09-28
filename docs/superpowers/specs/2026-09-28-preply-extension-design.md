# Schwanki Chrome Extension — Preply Discovery + Capture

Date: 2026-09-28
Status: approved design (brainstorming complete, pre-plan)
Builds on: `2026-09-23-schwanki-design.md` (Phase 1 core loop, implemented)

## 1. Purpose

The Phase 1 loop ingests vocab from Google Sheets/Docs. Two gaps remain:

1. **Setup friction** — the user takes classes with 5 teachers across 3 languages on
   Preply, each with a different note-taking habit. Wiring teacher → source is manual
   and context-free.
2. **The chat teacher** — one teacher sends vocab through Preply chat itself. There is
   no document to sync; those words currently never enter the system.

The Chrome extension closes both: it discovers the user's Preply teachers (name,
language, lesson activity) and captures individual chat messages into the existing
ingestion pipeline. Everything captured lands in the same Triage inbox and FSRS
review loop as every other source.

## 2. Decisions log (from brainstorming)

| Question | Decision |
|---|---|
| Scope | Discovery + capture (not discovery-only, not capture-only) |
| Chat capture UX | Manual 🪿 button per teacher message — no auto-parsing |
| Mapping UI location | Extension popup, on Preply, in context |
| Architecture | Thin extension; existing backend does the thinking (Approach 1) |
| Backend write path | Single new edge function `ingest-chat`; no direct table writes |
| Discovery technique | Hook Preply's internal API responses (fetch/XHR), DOM fallback |
| Auth | Piggyback on web-app Supabase session; API keys later at distribution |

## 3. Components

New workspace member `apps/extension` (MV3, TypeScript, vite + `@crxjs/vite-plugin`,
vitest). Four units, each with one job:

### 3.1 Content script: discovery (`content/discover.ts`)

- Injected on `preply.com` dashboard / lessons / tutors pages.
- Hooks `window.fetch` and `XMLHttpRequest` (page-world script via
  `world: "MAIN"` injection) to observe Preply's own API responses: tutor list,
  lesson schedule.
- Normalizes responses into:

```ts
interface DiscoveredTeacher {
  preplyTutorId: string;
  name: string;
  language: string;        // BCP-47, validated by packages/parsing language module
  lastLessonAt: string;    // ISO
}
```

- Persists the set in `chrome.storage.local` (key `discoveredTeachers`).
- DOM-scrape fallback if the hook yields nothing after page settle.
- Fails closed on Preply redesigns: no buttons, no exceptions into the page,
  reports "no data" to the popup.

### 3.2 Content script: chat capture (`content/capture.ts`)

- Injected on Preply chat pages. MutationObserver on the message list.
- Adds a 🪿 button on hover to each **teacher** message bubble (own messages get
  none). Full-size for teacher messages; none for the user's own.
- Click → sends `{ teacherId | threadDisplayName, messageText, capturedAt }` to the
  service worker. Button flips to ✓ "Sent — the goose has it" for 2s. One in-flight
  capture per message (double-click safe).
- No client-side parsing of message content — raw text only. Tier-2 owns extraction.
- Unmatched teacher: capture still sends, tagged with the thread display name;
  `ingest-chat` creates the source under that name; user renames in Sources later.

### 3.3 Popup (`popup/`)

- Lists discovered teachers with: name, language (editable select), wiring state.
- Per teacher, one of:
  - **Attach source** — paste Sheet/Doc URL → creates a normal `sources` row via the
    existing API (same as the web app's SourceForm).
  - **Capture from chat** — creates a `sources` row of type `preply_chat`.
- Reads/writes only through the service worker (no direct fetch from popup).

### 3.4 Service worker (`background/sw.ts`)

- Holds the Supabase session JWT; all backend calls go through here.
- Capture path: `ingest-chat` edge function call; on network/backend failure, push to
  `chrome.storage.local` outbox, badge = outbox length, retry via `chrome.alarms`
  every 15 min and on browser start. Nothing is silently dropped.
- Session acquisition: web app gains a tiny `/extension-auth` handoff page,
  whitelisted via `externally_connectable` to our extension ID, that returns the
  current session token to the extension on demand. No separate login flow.
- Session expired/missing → capture button tooltip "Sign into Schwanki first"
  (deep-links the web app); captures not attempted.

## 4. Backend changes

### 4.1 Migration `0004_preply_chat.sql`

- Allow `sources.type = 'preply_chat'` (extend the existing CHECK constraint).
- `external_ref` for `preply_chat` sources stores the Preply tutor id (or thread
  display name when unmatched).
- No new tables.

### 4.2 Edge function `ingest-chat`

- Auth: requires a valid user JWT (service role not allowed — this is a user-facing
  write path). Same explicit-guard pattern as the other functions.
- Body: `{ teacherRef: string, messageText: string, capturedAt: string,
  language?: string }`.
- Find-or-create the `preply_chat` source for `(user_id, teacherRef)` — idempotent:
  two captures from the same teacher → one source, two jobs.
- Enqueues an `llm_jobs` row with the raw message text → existing parse-worker →
  tier-2 LLM → `candidate_cards` → Triage inbox.
- Rate limit: 60 captures/hour/user (429 beyond that) to stop a runaway content
  script burning LLM tokens.

## 5. Error handling

| Failure | Behavior |
|---|---|
| No/expired session | Button tooltip "Sign into Schwanki first"; no capture attempt |
| Network/backend down | Outbox in `chrome.storage.local`; badge backlog; 15-min + startup retry |
| Preply redesign breaks injection | Fail closed; `window.__schwanki_version` beacon lets popup warn "extension needs an update" |
| Teacher unmatched | Capture proceeds with thread display name; rename later |
| Capture flood | 60/hour/user server-side rate limit |

## 6. Testing

- **Unit (vitest, chrome APIs mocked):** discovery normalizer against recorded Preply
  API response fixtures; message extraction; outbox retry logic.
- **Edge (deno test):** `ingest-chat` auth guard (anon 401, user 200, service role
  403); find-or-create idempotency; rate limit.
- **E2E (manual dogfood, no automated Preply login — ToS/bot-detection brittle):**
  real account — discovery lists the user's 5 teachers; capture from the chat
  teacher's thread lands in Triage.
- Recorded fixtures carry regression weight for Preply markup/API drift.

## 7. Out of scope (YAGNI)

- iTalki adapter (component boundaries allow it; build when Preply proves out)
- Auto-capture / hybrid vocab-list detection
- Chrome Web Store listing (side-loaded for dogfooding)
- Lesson-schedule-based review reminders
- Any change to Triage / Review / push (shared pipeline unchanged)

## 8. Definition of done

1. `pnpm -r test` and `pnpm -r typecheck` green including `apps/extension`;
   `deno test` green for `ingest-chat`.
2. Side-loaded extension on the founder's real Preply account: discovery lists all 5
   teachers with correct languages.
3. Mapping: attach KuanYing's sheet URL from the popup → appears in web app Sources.
4. Capture: 🪿 on a real chat message → candidate cards in Triage within one
   parse-worker cycle.
5. Kill network, capture, restore: outbox delivers without loss.
