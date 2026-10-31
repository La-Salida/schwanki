# Schwanki Voice Guide

The brand in words. Every user-facing string — buttons, errors, push notifications, empty states, paywall copy — follows this. When in doubt: would a corporate app say this? If yes, rewrite.

## Personality

Schwanki is the friend who roasts you in the group chat and you love them for it.
Confident, a little unhinged, genuinely on your side. Punching at *your excuses*, never at *you* for learning slowly.

- **Duolingo** is passive-aggressive guilt. Schwanki is affectionate trash talk.
- **Not** mean about skill, pace, or mistakes in learning. Mean about skipped reviews, abandoned streaks, and "I'll do it tomorrow."
- Swearing: implied, not literal, in product copy ("or else." beats profanity). Marketing can be spicier.

## Rules

1. **Short beats clever.** If a joke needs a second sentence, cut the joke.
2. **The mascot speaks.** First person, present tense, opinions included.
3. **Never blame the source.** Teachers' notes are chaos and Anki exports are messy; we love them anyway. Import and parser errors are *our* problem, framed with humor, not the user's.
4. **Numbers are sacred.** Streaks, counts, due cards — always accurate, never rounded for drama.
5. **No SaaS beige.** Banned: "Oops! Something went wrong", "We're working hard to...", "Oops", "Whoops", "Great job!" unironically, exclamation-mark piles.
6. **Anki is the ancestor, not the enemy.** Schwanki is "a modern take on Anki." Tease Anki's looks, never the learner's decks or the method; SRS is why this works.

## Copy patterns by surface

### Positioning lines (landing, store listing, social)
- "A modern take on Anki."
- "Doomscroll your vocab."
- "Scroll like it's a feed. Remember like it's Anki."
- Lead with the feed and the decks people already have. Tutor notes and Preply are features in the list, not the headline.

### Anki import
- Prompt: "Bring your Anki decks. Reviews, pictures, audio, all of it."
- Done: "1,204 cards moved in. Your review history came too. The goose is impressed (it won't say so)."
- Nothing usable: say exactly what's missing ("Every note needs a word and a meaning"), no joke in the way.

### Feed (phone review)
- Gesture hints stay plain and short: "Show meaning", "Got it", "Forgot", "Too easy".
- Rating buttons stay functional (see Review).
- End of queue: "That's the feed. You out-scrolled your due cards." (in the app). The landing demo ends on "Caught up."

### Push notifications (daily review reminder)
- "12 words are due. They miss you. (They don't. But your brain does.)"
- "Your Thai teacher added 9 new words. They saw you skipped yesterday."
- "Streak: 14 days. Day 15 is right there. Don't be weird about it."

### Triage inbox
- Header: "Fresh from your lesson" / "New loot from [teacher]'s sheet"
- Approve all: "All of it. Into the deck."
- Discard: "Nah" / "Never liked that word anyway"
- Empty state: "Nothing to triage. Either your teacher slacked off or you're caught up. (You're caught up.)"

### Review
- Rating buttons stay functional: Again / Hard / Good / Easy (clarity beats voice here)
- Session complete: "Done. Your future fluent self says thanks."
- Streak save: "Day 23. The streak lives. It was worried."

### Errors
- OAuth revoked: "[Teacher]'s doc stopped talking to us. Reconnect and we'll pretend nothing happened."
- Sync failed: "Couldn't read that doc. It's not you, it's permissions."
- Offline: "No internet. Good news: flashcards are from 1880. Keep going."

### Paywall / credits
- "Free gets you the deck. Credits get you the cinema."
- BYOK: "Bring your own keys. Your models, your tokens, zero markup. We're not animals."
- Out of credits: "You're out of credits. The goose suggests a refill. It's not asking."

### Onboarding (first import or sync)
- First choice is the Anki import; class notes are the second option.
- After first parse: "Found 47 words in your Sep 16 lesson. Your teacher did the work. You just have to not lose it."
- Notification ask: "I'll nag you daily. It's literally my whole job. Allow notifications."

## Naming

- The product: **Schwanki** (lowercase "schwanki" acceptable in casual contexts, never "Schwanki App")
- The mascot: **the goose** — "the Chaos Goose" formally, just "the goose" in copy. Smug, not angry: it judges, never threatens. (Decided 2026-09-24, see spec §9.3 and `inspiration/mascot/`)
- Phone review is "the feed"; a pass through it is still "a session".
- The deck is "the deck", candidates are "the inbox" or "fresh loot", a review session is "a session" (never "a lesson" — that's the teacher's word)
