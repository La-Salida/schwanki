# Schwanki iOS companion — proposed v1

Date: October 28, 2026. Updated October 29: structure and visual direction
approved; native implementation started in `apps/ios` at the user's request.
See [implementation status and device acceptance](ios-implementation.md).

Design study: [storyboard, wireframes and transitions](design/ios-v1/README.md).
Current visual source: [white/navy/blue index-card direction](design/ios-v1/visual-study-02/README.md),
verified against main on October 29; supersedes the older local palette.
Approved main-screen targets: [entry and revealed feed](design/ios-v1/approved/README.md).

## Product decision

**Open Schwanki. Review your words. Get on with your day.**

Build an iPhone app where existing learners can review immediately and people
who discover Schwanki on mobile can import an Anki deck and start there. Its
scope is **bring your deck, then review**: a simple import flow, a full-screen
feed, reliable offline reviews and an optional daily reminder.

The web app adds source connections, Inbox approval, editing and AI memory aids.
Both use the same Schwanki account, cards and review history. Explain this
relationship in one sentence during onboarding and provide a persistent
“Schwanki on the web” entry in Settings. Web setup is optional for learners who
already have an Anki export on their iPhone.

The entry experience must sell the whole Schwanki promise: messy language notes
from class documents, PDFs and screenshots can become memorable cards with
images, audio and examples, reviewed as a swipe feed. Anki import is an easy
starting path, not the entirety of the product. Promote the notes-to-cards
web path explicitly without adding native note creation to v1.

Make the source range recognizable with labeled Docs, Sheets, PDF, PowerPoint,
Canva PDF and screenshot icons inline with the notes paragraph. Keep marks tiny
(approximately 12–14 pt), baseline aligned with readable body text; no logo grid
or separate platform panel. Include Preply
and italki marks with explicit upcoming statuses: “Chat import · Coming soon”
for Preply and “Coming soon” for italki. These are informative roadmap previews,
not native connection controls, shipped-capability claims or implementation scope.

This native slice is now in development alongside the current web scope.

## Smallest useful release

| Include | Keep on the web |
| --- | --- |
| Sign in to the same Schwanki account | Source connections |
| Import Anki .apkg / .colpkg files from Files | Inbox approval and card editing |
| Review due cards, across all decks by default | Bulk content tools |
| Optional deck filter in a sheet | Deck organization and card browsing |
| Existing images, example sentences, readings and audio | AI generation, model choices and API keys |
| Durable offline ratings and automatic sync | Credits, purchases and billing |
| One optional daily reminder | Statistics dashboards and advanced study settings |

No bottom tab bar, separate home dashboard, social features, widgets, share
extension, background audio player, native iPad layout or Android release in v1.
Missing optional media never blocks a text review.

## Getting started

**Existing learner:** Welcome → sign in → first due card.

- Welcome leads with “Doomscroll your vocab.” Supporting copy connects messy
  notes and Anki decks to memorable illustrated cards, audio and examples.
  The primary action is “Get started” (create an account or sign in), with an
  “Already use Schwanki? Sign in” shortcut. A quiet sample preview remains
  available before authentication. Existing accounts with cards go straight to
  review; accounts without cards go to import.
- Sign-in uses the existing Schwanki identity. It does not request Google Drive
  access; connecting documents stays a separate web action.
- Fetch the first review batch and show the first card as soon as its text is
  ready. Load media separately. No language survey, goal picker, tour or
  notification permission prompt before reviewing.
- First card says “Tap to show meaning.” After reveal, the four named rating
  buttons teach the interaction. Gesture hints appear inline and disappear once
  used. Nobody has to learn swipes to use the app.

**No cards yet:** Show a useful empty state instead of an empty feed.

- Lead with the broader notes-to-feed promise and a compact sample illustration.
  Primary action: “Import an Anki deck,” opening the native
  Files picker. “How do I export from Anki?” expands short instructions for
  AnkiMobile and desktop, including scheduling and media export options.
- Offer a secondary “Try the feed · 3 sample cards” using bundled, clearly labeled demo
  content. Demo ratings never enter an account's learning history. The same
  preview can be reached from Welcome without signing in.
- Beneath the import action, promote “Got messy notes?” Explain: “Bring Docs,
  Sheets, PDFs or screenshots to Schwanki on the web. Create memorable cards
  there. Doomscroll them here.” Offer “Turn notes into cards on the web” as a
  concrete alternative for learners without Anki. Explain same-account sync at
  that handoff; the web path is optional for native Anki import.
- An account with pending Inbox words but no approved cards gets a specific
  “Check your new words on the web” action rather than another import prompt.

**Returning learner:** Open directly to the next due card. If a session was
interrupted, restore its deck filter and first unreviewed card with the answer
hidden. Refresh in the background without moving the card under their thumb.

## Anki import: the only content-creation flow in v1

**Choose file → preview → import → review.**

- Accept .apkg and .colpkg files through the standard Files picker, including
  iCloud Drive and other available file providers. No share extension in v1.
- Preview deck names and usable card counts. Select decks when an export has
  several; detect language where possible and let the learner confirm it.
  Explain skipped or unsupported content before committing the import.
- Carry over supported text, readings, examples, pictures and audio, using the
  existing import mapping and schedule reconstruction. Preserve the existing
  treatment of review history; do not promise perfect Anki template fidelity.
  Imported cards enter decks directly, bypassing the Inbox.
- Show progress and an accurate result: cards added, duplicates skipped and
  media failures. Interrupted imports must support safe retry without duplicate
  cards or resetting existing review schedules. Report partial completion and
  preserve media retry work; a repeated import must not leave missing media
  permanently unrecoverable. Initial import and account upload require internet.
- Completion leads to “Start reviewing” when cards are due. If nothing is due,
  say when to return rather than resetting imported schedules to create a session.
- Explain once: “This is a one-time Anki import. Future reviews sync between
  Schwanki on iPhone and the web; they don't sync back to Anki.” Never request
  an AnkiWeb password.
- Keep “Import Anki deck” in the deck picker so adding another deck is easy
  later. No separate library-management screen is needed.

## One main screen, with sheets for occasional tasks

### Review feed

- Full-screen off-black surface. Large word, reading, existing image and example
  sentence; yellow marks the target word. Revealing shows the meaning and
  answer-side content. Use the established Schwanki presentation defaults.
- Tap or swipe up reveals. Once revealed: up = Good, left = Again, right = Easy.
  Again / Hard / Good / Easy remain visible; ratings activate only after reveal.
  A drag previews its action. One gesture can perform only one action.
- Top controls: deck selector, sound toggle and settings. “All decks” is the
  default. The selector lists names and available due counts, with no deck admin.
- A thin progress bar describes the current batch. It does not claim a finite
  daily goal or treat a 50-card batch as the entire due queue.
- Audio follows the saved device preference, respects iOS sound behavior and
  has a manual replay control. Pause on leaving the feed. No audio permission
  request or forced playback on entry.
- Stop reviewing at any time by closing the app. Every completed rating has
  already been saved; there is no “finish session” requirement.

### Settings sheet

Only: daily reminder/time, sound preference, new cards per day, sync status and
“Sync now,” account, “Schwanki on the web,” help/privacy, sign out and account
deletion. Keep account deletion behind its own explicit confirmation.

“Schwanki on the web” explains the available tools and opens the real web app.
Browser authentication is separate: say “Use the same account” and show the
current account identity. On returning to iOS, sync automatically and keep a
visible retry action. Neither onboarding nor routine review needs a web tour.

Reuse the current 20-new-cards/day default and 4 a.m. local study-day rollover.
The new-card limit and sound preference are device-local in v1, matching the
existing web model. Say so; do not imply settings sync across devices.

### Completion / waiting state

- When the batch ends, fetch the next due batch or offer “Keep reviewing” if
  more are available. Again cards re-enter using their updated state, matching
  the existing session behavior.
- Only show “Nothing due right now” after a successful queue refresh confirms
  it. An exhausted offline cache says “You've reviewed the cards saved here.
  Connect to check for more.” A failed request is an error with Retry.
- Use the goose and one short completion line. No statistics dashboard or
  upsell. After the first completed real session, offer “Remind me tomorrow”
  with a time picker. Ask for iOS notification permission only after opt-in.
- Use one local daily reminder with generic wording, such as “A few words?
  The goose is waiting.” It works offline and makes no unverified due-count or
  streak claim. Denying permission never blocks reviews.

## Reliability is part of the minimum

- First sign-in and initial download need internet. Thereafter, cards already
  saved on this device remain reviewable offline. Do not promise the entire
  collection or future days are downloaded.
- Save each rating's stable event ID, timestamp, resulting schedule and outbox
  entry in one SQLite transaction **before** advancing. A failed local save
  leaves the card in place with Retry. Disable duplicate input during the save.
- Sync the outbox in order on launch, foregrounding and reconnect; acknowledge
  before removing an event. Retry with the original ID. Use the existing atomic
  `save_review` endpoint. Do not depend on iOS background execution.
- Preserve local schedules with pending events when refreshing remote cards.
  Scope storage, media and outbox by account. Expired authentication pauses
  upload and asks the learner to sign in again without losing pending reviews.
- Before voluntary sign-out, flush pending reviews. If that fails, retain the
  session and explain that reviews must sync first, following existing behavior.
- Download media for the current batch opportunistically. Local files, rather
  than expiring signed URLs, provide offline playback. If a file is unavailable,
  retain the card and show the available text. Start with a bounded cache;
  protect the active batch and never evict pending review records.
- Sync before beginning an online session. Concurrent offline reviews on two
  devices can still produce conflicting schedules; test that case explicitly.
  The existing server preserves events and prevents older events replacing newer
  schedules, but does not establish a full schedule-reconciliation system.
  Don't advertise seamless simultaneous offline study.

## Build approach

Use **Expo + React Native + TypeScript** in `apps/ios`, with the current Supabase
backend and `@schwanki/core`. This follows the repo's intended mobile direction
and avoids maintaining a second scheduler. Build native screens, rather than
wrapping the website.

Reuse card types, FSRS, queue ordering, daily new-card counting API, media API and
review-saving API. Extract only needed portable policy, such as study-day
calculation, from web code. Extract Anki field mapping, format decoding and
import planning into a shared module where portable; reuse core import APIs.
Leave class-note ingestion and AI packages alone.

The existing Anki reader is under `apps/web/src/lib/anki` and its entry point
uses browser File/Blob APIs and a Vite-loaded sql.js WASM asset. It is not a
drop-in React Native importer. First prove legacy and modern compressed exports
on a physical iPhone; use native filesystem/SQLite adapters for extracted
collections and compatible archive/decompression code. Keep parsing off the
interaction path, clean up temporary files, and measure peak memory with large
media-heavy decks. Set an explicit supported file-size bound from that test;
offer web import for files beyond it. Native import is the primary path for
supported exports, not a disguised browser handoff.

Implement native adapters for SQLite storage, secure session persistence,
OAuth callback handling, connectivity, local media files, audio and local
notifications. The web implementation uses IndexedDB, browser locks,
localStorage and DOM components; those are references, not drop-in native code.
Verify UUID generation and other runtime assumptions in the shared API client.

The current due-card API defaults to a capped fetch. Use honest batch labels
and fetch subsequent cards as needed; do not present a capped response as an
exact collection-wide due count. Only add pagination/count APIs where the
review flow actually requires them.

## Delivery order and acceptance

1. **End-to-end online slice.** Sign in to an existing account, load a real deck,
   reveal and rate through buttons, persist via the shared API, and confirm the
   changed schedule in the web app. Test on a physical iPhone. Establish account
   mapping and callbacks before polishing animation.
2. **Mobile-first import slice.** Create an account on iPhone, choose an export
   from Files, preview, import and review. Verify cards and reconstructed
   schedules on the web using the same account. Cover legacy/current .apkg and
   .colpkg exports, supported media, skipped notes, duplicates, interruption and
   retry, malformed files and measured large-file limits. Confirm retry can
   recover media for already-created cards without resetting their schedules.
3. **Durable offline slice.** Add SQLite, restore, FIFO sync and media caching.
   Acceptance: rate offline, force-quit, reopen offline, reconnect and retry the
   upload; exactly one event remains, the schedule is retained, and the next
   card is correct. Also test failed writes, stale refreshes, expired auth,
   deleted cards, account isolation and two-device conflicts.
4. **Focused experience.** Add gestures, deck/settings sheets, empty states,
   sample preview, completion and the local reminder. Check VoiceOver, Dynamic
   Type, reduced motion, contrast, touch targets, unavailable media and a small
   iPhone screen. Buttons must fully substitute for gestures.
5. **TestFlight, then App Store.** Dogfood daily for a week. Before public release,
   settle the iOS authentication offering, account deletion and store metadata.
   Existing Google sign-in needs an App Store login-policy review; include
   Sign in with Apple if required, with tested linking to existing accounts.
   Do not create an apparently empty second account through a new provider.
   Verify store rules for any web links; v1 has no credit purchase or AI upsell
   flow and assumes no special reader-app entitlement.

Success: an existing learner reaches their first card without instructions;
a mobile-first learner imports their own deck without needing web setup. Both
review comfortably with one thumb and see their cards and reviews on the web
after sync. Aim for first card within 30 seconds of completing sign-in for an
existing populated account on a normal connection; measure import time
separately by file size. No lost or duplicated ratings in offline acceptance.

## Expansion rule

Add a feature only when it removes a repeated interruption to reviewing.
Inbox approval is the first candidate if daily use proves that switching to the
web regularly prevents practice. Additional import formats, advanced mapping
and library management wait for evidence that the simple Anki flow is inadequate.

## Basis

- `DESIGN.md`: current feed, gesture, visual and durable-save rules.
- `docs/working-scope.md`: Anki-first positioning and current deferred native scope.
- `docs/brand/copy.md`: short functional instructions and restrained goose voice.
- `packages/core/src/{session,fsrs,api}.ts`: existing portable scheduling and API.
- `apps/web/src/lib/anki/`: import mapping, scheduling and browser-runtime limits.
- `apps/web/src/offline/`: durable outbox and sign-out behavior to preserve.
- `apps/web/src/lib/newCardLimit.ts`: current study-day and new-card policy.
- `docs/launch-readiness.md`: existing verification limits, especially cross-device
  offline conflicts. These are context, not evidence that a native app is tested.
