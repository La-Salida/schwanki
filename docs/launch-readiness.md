# Launch gates — 2026-10-21

Scope: sign in, bring an existing Anki deck, review reliably, and receive purchased credits. No additional product features are required by this checklist.

| Gate | Evidence | Remaining acceptance |
| --- | --- | --- |
| Deployable schema history | Remote migration history was fetched read-only. The Anki source constraint already exists remotely as `20261020040639`; the local equivalent is renamed to match. No production schema or history repair was performed. | Confirm the Supabase Preview check succeeds after merge. |
| Anki import | Legacy and current compressed package parser tests cover fields, media, history, schedules and suspended cards. Actual `update1.apkg`, `diffmodels2-1.apkg` and `media.apkg` fixtures from ankitects/anki commit `b5df43b6a05d1270f33f6c2457eb937d8be9eda4` were checked locally. The audio-only fixture is explicitly skipped, consistent with the text-card importer. | Sign in with a real account; import a representative personal `.apkg`/`.colpkg`, including media and review history; reload and verify counts, media and due dates. Large personal decks have not been certified. |
| Durable reviews | Ratings and cached schedules commit in one IndexedDB transaction before advancing. All saves use the FIFO outbox. Regression tests cover reload, stale refresh, failure to persist locally and newer local schedules after a flush. | In a real signed-in session, rate cards online/offline, reload, reconnect and verify server state. Database/network requests and multi-tab concurrency are not certified by IndexedDB tests. |
| Payment fulfillment | Signed webhook handler tests cover paid completed/delayed events, duplicate-session handling, rejection paths and retryable database failures. Billing-document tests cover ownership and allowed document hosts. | Use a Schwanki Stripe sandbox: finish Checkout, confirm one credit grant, redeliver the event, confirm no second grant, and open the receipt/invoice from Billing. |

## Current external blockers

- The connected Stripe account exposes live mode only. The CLI is authenticated to a different product's sandbox with an expired test credential. Neither was used for a purchase. Configure a Schwanki sandbox before payment acceptance testing; do not use live charges or another product's account as a substitute.
- Local web configuration points at local Supabase, which is not running. The deployed frontend uses the real backend; it is not an isolated acceptance environment. No authenticated production data was modified for these tests.

Launch remains gated on the real import/review and sandbox purchase checks. Passing mocked/unit checks alone does not close those gates. Separate production deployments still require approval.
