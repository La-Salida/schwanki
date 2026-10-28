# Schwanki design direction

Updated: October 23, 2026. Supersedes the "class notebook" pass of October 7.

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

- **The feed (review on every screen).** Opens directly when cards are due.
  Full screen, one card per screen, on the
  leather-black cover. Swipe up to move on; the four ratings stay visible at the
  bottom. The word is huge, the example sentence highlights it, and the card's
  image or clip fills the screen. The next card's media is loaded while the
  current one is showing. Desktop uses the same feed with a wider text and rating
  area. Scroll down, swipe up, or use the keyboard to reveal, then rate.
  Exiting opens the notebook overview for choosing a specific deck.
- **The notebook (everything else).** Paper cream pages for importing decks,
  checking new words in the Inbox, managing decks and class notes, and
  Settings. Calm, list-based, minimal chrome.

The landing page integrates a full-viewport review demonstration into the hero.
The feed media fills the screen edge to edge, with the headline overlaid and
review controls kept clear of the copy. No phone frame contains the demo. Page
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
- Palette (October 28, the index card): white card stock (`paper`), navy ink
  (`ink` `#14213D`), ruled blue (`ruled` `#2346B8`) for the primary action and
  links, faint blue rules (`lines`) behind pages, and the red margin rule
  (`margin` `#C8372D`) as one line across the top of a page or card, plus
  errors. Acid yellow (`acid`) belongs to the vocabulary word only. Pastels
  (mint, lilac, sky, blush) mark languages and decks only. `.index-card` is the
  shared white, ruled, red-topped surface. The review feed stays dark.
- Mascot: the leather-jacket Chaos Goose at entry, empty, reminder, streak and
  completion moments. It hoards your words; you pay it back in reviews.
- No all-caps eyebrows above headings, numbered "01/02/03" steps, badge pills
  on pricing, a highlighted middle plan, decorative left stripes, or arrows on
  links that stay on the site. The navigation uses the actual goose beside the
  wordmark; do not invent a monogram or add a glow.
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
- The memory-aid editor uses a side panel on desktop and a bottom sheet on
  phones. Its word, reading and meaning stay in a fixed header while controls
  scroll. One create/replace action leads; individual parts and advanced model
  choices are secondary. Opening or closing it never rates the card.
- Review display is adjustable from the feed gear and Settings. Word + image,
  word, image, audio, and meaning can lead a card. Each field can appear before
  reveal, after reveal, on both sides, or stay hidden. Defaults show the word,
  reading and image first. Choices and autoplay are saved on this device.
  Missing media offers a reveal action without exposing hidden text; blocked
  autoplay offers manual playback.
- Progress shows as a thin bar at the top, not a counter that nags.
- Ratings advance after a durable local save; network sync runs in the background.
  One scroll gesture performs one action, including across card changes.

## Reasons for the visual choices

- The black feed reads as "your phone's video app", which is the habit
  Schwanki borrows. Cream pages read as a notebook, where careful work
  (importing, checking words) happens.
- Blue marks the primary action; navy handles secondary actions and text. The
  ruled lines and red margin rule make every page read as a flashcard.
- Archivo carries the editorial voice without adding another typeface.
- Lists keep decks, teachers and classes comparable; review is a card because
  the learner flips and rates it.
- Highlighting marks the target word inside a generated sentence so the
  learner finds it in context, in the feed and on the landing page.
- Modest control radii distinguish typography, inputs and flashcards.

## Scope

Landing/sign-in, the public pricing page (/pricing: free plan, credit packs priced
per card, bring-your-own-keys), onboarding (Anki import first, class notes second), the
phone feed and desktop review, Inbox, Decks & notes, Settings (keys and
credits), account identity/logout, billing and invoices, extension connection,
shared forms and dialogs. Authenticated navigation includes the credit balance,
a Buy credits action, and the account menu. Listening packs and class recording
stay deferred.
