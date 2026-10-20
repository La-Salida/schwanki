# Schwanki design direction

Updated: October 20, 2026. Supersedes the "class notebook" pass of October 7.

Schwanki is a modern take on Anki: spaced repetition you scroll like a social
feed. The scheduler (FSRS) decides which card comes next; the interface makes
getting through the queue feel like doomscrolling instead of homework. Most
learners arrive with Anki decks, so importing one is the first path. Class
notes (Google Sheets/Docs, PDFs, Canva, Preply) are integrations that keep
adding words afterwards. They are not the product's identity.

The product story and visual rules are in
`docs/superpowers/specs/2026-09-23-schwanki-design.md` (§1 and §9, with the
October 19 direction update). Copy rules are in `docs/brand/copy.md`.

## Two surfaces

- **The feed (phone review).** Full screen, one card per screen, on the
  leather-black cover. Swipe up to move on; the four ratings stay visible at the
  bottom. The word is huge, the example sentence highlights it, and the card's
  image or clip fills the screen. The next card's media is loaded while the
  current one is showing, so the scroll never waits. Phone widths (under 640px)
  get the feed; the desktop keeps the flashcard with its rating row.
- **The notebook (everything else).** Paper cream pages for importing decks,
  checking new words in the Inbox, managing decks and class notes, and
  Settings. Calm, list-based, minimal chrome.

The landing page integrates the review demonstration into the hero. Page
scroll starts with the Schwanki phone feed, reveals the first word’s meaning, advances
through sample cards, and ends with a completed queue. An optional “Compare
with Anki” control shows an illustrated traditional review of the same word;
the default view always leads with Schwanki. The headline stays
alongside the demonstration. Manual step controls and a skip link remain
available; reduced motion and short windows use a static, manually stepped
layout. Sample scenes are labelled as a demo, not live learner reviews.
Supporting notebook sections show Anki migration, optional sentence/image/audio
enhancement, and class notes becoming Inbox suggestions. Public deck browsing
and per-card video generation remain deferred, as in the working scope.

## Visual system

- Typography: Archivo, bold editorial headings, readable body copy. The
  vocabulary word is the focal point in every review layout.
- Palette: paper cream (`cream`) and leather off-black (`ink`), beak orange
  (`beak`) for the primary action, acid yellow (`acid`) for the highlighted
  word and sparing highlights. Pastels (mint, lilac, sky, blush) mark languages
  and decks only.
- Mascot: the leather-jacket Chaos Goose at entry, empty, reminder, streak and
  completion moments. It hoards your words; you pay it back in reviews.
- Voice: smug and direct. Instructions and errors stay specific; the goose's
  joke never hides the next action.
- Dials: ENERGY 3 / RHYTHM 3 / MOTION 2. The feed moves (swipe, snap, card
  entry, autoplaying audio); notebook pages keep hover and focus feedback
  without decorative motion. Respect `prefers-reduced-motion`.

## Feed rules

- The scheduler picks the order. Scrolling never skips a due card or invents
  a review.
- Gestures: on a hidden card, a tap or swipe up shows the meaning (you look
  before you move on). On a shown card, swipe up is Good ("Got it"), swipe
  left is Again ("Forgot"), swipe right is Easy ("Too easy"). A label shows
  what letting go will do. The four ratings stay one tap away.
- Media is the hook: image first, word and sentence on top, a shade so text
  stays readable on any picture.
- Sound respects the learner: audio autoplays with one mute toggle,
  remembered on the device.
- Editing and "Make it memorable" open as sheets over the feed, so the
  learner never loses their place.
- Progress shows as a thin bar at the top, not a counter that nags.

## Reasons for the visual choices

- The black feed reads as "your phone's video app", which is the habit
  Schwanki borrows. Cream pages read as a notebook, where careful work
  (importing, checking words) happens.
- Orange marks the primary action; black handles secondary actions and text.
- Archivo carries the editorial voice without adding another typeface.
- Lists keep decks, teachers and classes comparable; review is a card because
  the learner flips and rates it.
- Highlighting marks the target word inside a generated sentence so the
  learner finds it in context, in the feed and on the landing page.
- Modest control radii distinguish typography, inputs and flashcards.

## Scope

Landing/sign-in, onboarding (Anki import first, class notes second), the
phone feed and desktop review, Inbox, Decks & notes, Settings (keys and
credits), extension connection, shared forms and dialogs. Listening packs and
class recording stay deferred.
