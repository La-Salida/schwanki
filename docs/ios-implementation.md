# iOS companion implementation

October 29, 2026. The initial native companion is implemented in `apps/ios` on
branch `codex/ios-companion`. It is ready for development review, with native
device acceptance still pending. Nothing has been deployed or released.

The approved scope remains small: Anki import, review, offline ratings, deck
selection, optional reminder and essential account settings. The app explains
how messy language notes become illustrated cards on the web and sync back to
the same account. Source connections, Inbox, editing and AI creation remain web
features. Preply chat and italki are explicitly future capabilities.

## Code and boundaries

October 30 update: the user confirmed the same backend as the web app and has a
Mac/iPhone for testing. Native local configuration now targets the hosted web
project, using the public client key recovered from its published build. The
Mac source download includes only that public native configuration; the local
web development environment remains unchanged. An iPhone build command and
[first-run instructions](ios-mac-setup.md) are included. Hosted OAuth settings,
the Anki migration and physical-device validation are still pending.

| Location | Responsibility |
| --- | --- |
| `apps/ios/src/screens` | Entry, full-screen feed, import sheet, Settings |
| `apps/ios/src/lib/storage.ts` | Serialized SQLite transactions, per-account card cache, outbox and session |
| `apps/ios/src/lib/useLibrary.ts` | Cache-first review, deck filtering, stale-refresh protection and refresh lifecycle |
| `apps/ios/src/lib/sync.ts` | FIFO retries using stable event IDs and the existing atomic review RPC |
| `apps/ios/src/lib/importer.ts` | Files picker, native SQLite import, durable checkpoints and media retry |
| `apps/ios/src/lib/backend.ts` | Public Supabase client, Keychain sessions and offline identity |
| `apps/ios/src/lib/media.ts` | Per-account downloaded media cache with bounded pruning |
| `packages/anki` | Shared classic/modern Anki parsing and import plan, with SQL driver boundary |
| `packages/core` | Existing scheduling/API plus historical log replay and atomic import client |
| `supabase/migrations/20261029100000_atomic_anki_import.sql` | RLS-protected, atomic and retry-safe card/schedule/history import |

The web importer reexports the shared parser and keeps its existing browser
SQLite driver and API path. Native import uses the new atomic endpoint to avoid
leaving a card without its schedule if the app is interrupted between requests.
Existing card schedules/history are preserved on duplicate retries; media on a
card from a different source is never replaced by this import.

## Automated and local evidence

- Real SQLite tests cover reopen/restart, write rollback, stable duplicate IDs,
  FIFO failures, deleted-card handling, account separation, expired auth, cache
  hydration before a slow refresh and a refresh racing a rating.
- PGlite tests execute the real import migration with PostgreSQL RLS, covering
  rollback, ownership, duplicates, media ownership and request bounds.
- Anki fixtures exercise legacy/current packages, Zstd and protobuf, identical
  SQL.js/native-adapter output, scheduling/history and expanded-size bounds.
- Type checking covers every workspace package. iOS Hermes and web exports
  verify Metro resolution, bundled fonts/assets and platform module imports.
- Headless Chromium tests exercise the actual exported shared screens: entry,
  export help, web handoff, reveal-before-rating, the three-card sample and its
  completion, unavailable sign-in feedback, and 375×667 / 390×844 layouts.
  This does not substitute for native acceptance.
- Expo config introspection verifies the URL scheme and avoids recording,
  background audio, Face ID prompts and remote-push entitlements. The reminder
  uses local notifications only. No permission is requested on first launch.

See [native setup](../apps/ios/README.md) and
[visual comparison evidence](../apps/ios/design-qa.md).

## Native acceptance before TestFlight

October 30, 2026: a local Xcode development build succeeded and ran in the
iOS 27 simulator (402 × 874 points). The repeatable
`apps/ios/qa/native-smoke.mjs` check exercised native accessibility presses and
touch swipes: export help, reveal-before-rating, all four ratings, mute/audio
controls, three-card completion, exit/back navigation and the web handoff sheet.
Large Dynamic Type can use a two-column rating layout so labels stay readable.
The feed word and compact rating labels scale up to 1.5×, while the meaning and
example use the system text size and remain scrollable.
Screenshots and the machine-readable report are local, ignored artifacts in
`apps/ios/qa/output/native`. Audio control behavior was exercised; physical
speaker output, silent-switch and interruptions are not certified by this check.

The three initial review findings now have regression coverage: the selected
deck is filtered before either remote row cap, completed scoped refreshes retain
other offline decks, acknowledged new-card starts persist across restart and
metadata failures, and import retries revalidate a checkpointed source’s language.
Acknowledgements and daily-budget reads are serialized to avoid losing a start
while it moves out of the upload queue. Generated Edge sources are current.

The following account/device checks remain unverified; the backend migration
has only been executed in local PostgreSQL tests.

1. Configure development Supabase public values and the allowed native OAuth
   redirect; apply the migration in development/staging. Run an Xcode development
   build and verify first install, cold start, Keychain persistence, Google
   cancellation and successful return, expired login and reauthentication.
2. Import real classic/current `.apkg` and `.colpkg` files from iCloud/local
   Files, including media and history. Test malformed/oversized exports, mixed
   deck selection, duplicates, backgrounding/force-quit mid-import, lost replies,
   media retry and the 30 MB boundary on the oldest supported iPhone.
3. Review in airplane mode, force-quit/reopen, reconnect and verify exactly one
   server event per rating and the same resulting schedule on web. Test Again,
   undo-free deliberate reveal, filtered queues, daily limit rollover and stale
   refreshes. Confirm pending reviews block sign-out and survive auth expiry.
4. Verify Japanese/Chinese text, long answers, Dynamic Type, VoiceOver order,
   safe areas, reduced motion, button reachability and swipe-vs-scroll behavior.
   Check real codecs, silent switch, audio interruption and lock/background pause.
5. Exercise reminder allow/deny, time changes and replacement, daylight saving,
   cancellation on sign-out, and real-device delivery. Verify account deletion
   against the existing Edge Function and local cleanup with a disposable account.
6. Complete Apple account/signing configuration and App Store requirements:
   account-access options (including Sign in with Apple/account linking where
   required), privacy disclosures/manifest, accessibility review, screenshots
   and a TestFlight build. Google-only access has not been cleared for release.

## Remaining implementation limits

See the native README for import/cache limits and the absence of multi-device
offline conflict reconciliation. A generic inline chat icon identifies Preply
chat pending an official reusable brand asset; its label stays Coming soon.
A local simulator binary was built. No production migration, device-signed IPA,
EAS upload or App Store submission was made.
