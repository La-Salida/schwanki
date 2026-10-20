# Schwanki working scope

Updated: October 20, 2026. Replaces the October 7 scope, which was about
finishing class PDF imports (that slice shipped; see git history for its
acceptance checks).

## Product in one line

A modern take on Anki: spaced repetition (FSRS) reviewed as a full-screen
swipe feed on your phone. Bring your Anki decks; keep adding words from class
notes and other integrations.

## How cards get in

1. **Anki deck import (main path).** `.apkg` / `.colpkg` files are read in the
   browser. Notes become cards with their scheduling state and review
   history, plus the pictures and audio they use. Imported cards go straight
   into the deck; they don't pass through the Inbox. Onboarding offers this
   first.
2. **Integrations (secondary).** Each one is a source that keeps feeding new
   words to the Inbox for the learner to approve:
   - Google Sheets and Google Docs (read via Google sign-in)
   - Class PDFs, one per class, labelled by teacher and date
   - Canva exports (as PDFs)
   - Preply: paste a teacher's profile link to fill in their name, photo and
     language

   Preply is one integration among these, not a requirement. Teachers are
   optional labels for grouping class notes, so a learner with only Anki
   decks never has to set one up.

## How cards get reviewed

- **Phone (PWA, under 640px wide):** the swipe feed. One card per screen,
  swipe up to reveal and then to rate Good, left for Again, right for Easy,
  rating buttons always visible. Next card's media is preloaded. See
  `DESIGN.md`.
- **Desktop:** the flashcard with its rating row.
- No native app for now. The PWA installs to the home screen, works offline
  from a cached due queue and an outbox of ratings, and sends push reminders.

## What makes a card stick

"Make it memorable" adds an example sentence with the word highlighted, an
image and audio. Schwanki's own AI keys (Fal, ElevenLabs, DeepSeek)
are the default, paid with credits; learners can bring their own keys and
choose a model per task in Settings.

## Current priorities

1. Anki import works on real decks (large decks, media, review history) and
   the first feed session after import feels good.
2. Feed quality on phones: smooth swipes, media preloaded, no lost ratings
   offline.
3. Integrations keep working (sync errors visible, progress shown), without
   new Preply-only features.

## Deferred

Preply chat capture (extension), manual card entry, per-card AI video,
Japanese chat import, class recording and transcription, listening packs,
native mobile apps, shared decks.
