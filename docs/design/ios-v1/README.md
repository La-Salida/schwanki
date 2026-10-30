# Schwanki iOS — storyboard and wireframes

October 28, 2026 · Design study 01 · Proposed flow, not an implementation.

The brief: a minimal iPhone app where someone can bring an Anki deck, review
their words and understand how the web companion fits. Existing Schwanki users
go straight to their cards. Web setup is optional for a supported Anki import.

October 29 update: structure and visual direction approved. Use the
[approved main-screen targets](approved/README.md). The entry screen promotes
messy notes becoming illustrated cards to doomscroll, with native Anki import
and tiny inline format/platform marks in normal prose. Upcoming platform
connections remain explicitly labeled. The revealed feed retains its navy/blue
treatment. These supersede earlier palette and logo-grid explorations.
The native implementation has started in `apps/ios` following approval of the
main screens. See [implementation status](../../ios-implementation.md).

## Review the boards

- [Four-page vector PDF](schwanki-ios-storyboard-wireframes.pdf)
- [Storyboard](00-storyboard.png) · [Editable SVG](00-storyboard.svg)
- [First use and import, 01–06](01-import-wireframes.png) · [Editable SVG](01-import-wireframes.svg)
- [Review and utility sheets, 07–12](02-review-wireframes.png) · [Editable SVG](02-review-wireframes.svg)
- [Web companion and recovery, 13–18](03-web-offline-wireframes.png) · [Editable SVG](03-web-offline-wireframes.svg)

Read the storyboard first, then each wireframe board left to right, top to
bottom. These 18 frames include alternate states of the same screen; they
are not 18 navigation destinations. Sheets are drawn in isolation so their
contents are legible. They appear over the current feed and dismiss back to it.

The drawings intentionally use neutral typography, grayscale controls and
placeholders. Visual passes apply Archivo, Schwanki's current index-card palette,
the real goose and representative card imagery. Full-screen review media and
the dark-feed/light-utility distinction carry forward from `DESIGN.md`.
All decks, counts, account details and times are illustrative. This is not a
clickable prototype and does not validate performance, sync or iOS behavior.

Figma file creation succeeded, but the Starter-plan MCP limit blocked reading
and editing its canvas. That file is blank; these local SVG/PDF boards are the
actual deliverables. The SVGs preserve editable text and vector shapes.

## Storyboard

1. **First deck on iPhone.** Discover Schwanki → enter an account → choose an
   Anki file → understand the preview → import → reveal and rate an own card.
2. **Daily habit.** Open directly to a due word → reveal → rate → leave whenever
   needed. Offer a reminder after a real session, not before the first card.
3. **Trust across devices.** Review cached cards offline → keep ratings on the
   phone → explain when the cache ends → sync after reconnect → see the same
   cards and reviews on the web using the same account.

## Frame map and transitions

| Frame | Main action | Next state |
| --- | --- | --- |
| 01 Welcome | Get started / Sign in | 02 account; sample preview is available without an account |
| 02 Account | Continue with Google | Existing cards → 07; empty account → 03; no due cards → 10 variant |
| 03 Bring a deck | Choose Anki file | Native Files picker → read file → 04 preview |
| 04 Preview | Import selected cards | 05 progress; show unsupported content before confirmation |
| 05 Importing | Wait for completion | 06 result; interruption → 16 |
| 06 Complete | Start reviewing | 07 if due; otherwise honest next-due waiting state |
| 07 Hidden card | Tap / swipe up | 08 revealed, without recording a rating |
| 08 Revealed card | Again / Hard / Good / Easy | Durable save → next 07; failed save → 17 |
| 09 Deck sheet | Select a deck | Due card 07, or a deck-specific waiting state; import opens 03 |
| 10 Caught up | Remind me tomorrow | 11 reminder; Done leaves the waiting state |
| 11 Reminder sheet | Enable reminder | iOS permission request, then return; Not now dismisses |
| 12 Settings sheet | Choose a setting | Edit inline or open child sheet; web entry → 13 |
| 13 Web companion | Open schwankiapp.com | Browser sign-in using the same account; app refreshes on return |
| 14 Offline card | Reveal / rate | Same feed, durable local save; exhausted cache → 15 |
| 15 Cache exhausted | Try connection again | Reconnect → upload ratings → refresh queue; failed retry retains state |
| 16 Import stopped | Retry import | 05 progress, retaining completed cards and media retry work |
| 17 Save failed | Retry Good | Save that selected rating; advance only after success |
| 18 Auth expired | Sign in again | Same account → sync and resume; offline review remains available |

## Details that do not need separate app screens

- **Export help:** expand under the button in 03. Default to iPhone guidance:
  open AnkiMobile → Add/Export → Export/Share → include media → Save to Files →
  return to Schwanki. Offer Computer guidance as a secondary choice, including
  scheduling and media export options. Reuse the existing export guide wording.
  A person with neither a deck nor Anki can try the sample; source connections
  remain an optional web path, not an implied built-in deck catalog.
- **System Files and provider login:** use the native/system surface; do not
  build custom file browsing or imitate an external sign-in page. Cancelling
  returns to the prior state without an error.
- **Sample mode:** use the same feed with a persistent “Sample · 1 of 3” label,
  an exit control and “Import my deck” at the end. Demo ratings do not affect
  review history, new-card allowance or reminders. Importing requires an account.
- **Account with pending words only:** replace 03's main explanation with
  “Your new words are waiting for approval on the web,” show the web action
  and retain Anki import as an alternative.
- **Nothing due after import:** use 10's layout with “Your deck is ready.
  Nothing is due right now.” Show the next due time only if it is known. Do
  not move future cards forward just to manufacture the first review.
- **More due batches:** exhaustion of the current batch loads the next batch
  or offers Keep reviewing; it is not a daily-completion claim.
- **Unreadable file:** return to 03 with a specific explanation and Choose
  another file. Exceeding tested size limits offers web import as a fallback.
- **Partial media failure:** 06 reports the exact number of missing media
  items and offers Retry missing media; text review remains available.
- **No cached media:** omit the image/audio gracefully; keep reveal and rate
  available. A missing optional asset must not reveal hidden answer fields.
- **Reminder denied:** 11 explains that reminders are off, links to iOS
  Settings if wanted and offers Done. Do not repeatedly prompt.
- **Sign out and deletion:** sign out waits for queued reviews to sync.
  Deletion gets a separate confirmation naming permanent data loss. This
  destructive action must not double as a sync-error escape hatch.

## Interaction and accessibility notes

- No bottom navigation, separate dashboard or forced onboarding tutorial.
  Decks and Settings open from the feed. Dismissal never rates a card.
- Feed gestures: hidden + up = reveal; revealed + up = Good, left = Again,
  right = Easy. Show a live action label before a drag commits. One gesture
  cannot reveal and rate. Hard is always available through the rating buttons.
- Four named rating buttons remain visible, activating only after reveal.
  A failed local write retains the revealed card and selected rating; the
  retry state must not accidentally advance to a different word.
- Every action remains available without gestures. Use at least 44 pt touch
  targets. Inline links shown here need generous hit areas in the final design.
- These frames use a 390 × 844 pt reference viewport. Content must reflow and
  scroll with larger text, long words/translations and smaller iPhones. Keep
  safe-area padding, the primary action and ratings accessible. The final
  answer layout needs overflow handling; fixed screenshot positions are not
  implementation constraints.
- Restore the first unreviewed card with the answer hidden on return. A remote
  refresh must not swap the current card during a gesture or reveal its answer.
- Pause audio when the feed leaves the foreground. Keep playback and mute
  controls accessible; do not add audio permission setup.
- Web context appears on 02/03 and remains in 12/13. Never imply the browser
  is automatically signed in. Refresh on return from the browser.

## Decisions to carry into the next pass

The structure is ready for discussion: a lightweight first-use route, direct
daily entry to the feed, and secondary sheets. Focus feedback on whether any
screen adds unnecessary work or leaves the next action unclear.

The account wireframe reflects the currently available Google provider.
Sign in with Apple requirements and identity linking remain a pre-release
implementation decision, not a settled capability shown by these drawings.

No application code, dependencies, backend configuration or live data changed.
The agreed scope remains in [the companion plan](../../ios-companion-plan.md).
