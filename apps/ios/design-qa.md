# Schwanki companion — shared-screen visual QA

Date: October 29, 2026. This result covers the rendered shared React Native
screens and sample flow. **Native iOS acceptance is still unverified**; this is
not an Xcode/simulator result or App Store release approval.

## Visual truth and captures

- Source entry: `docs/design/ios-v1/approved/03-notes-to-feed.png`.
- Source feed: `docs/design/ios-v1/approved/08-review-revealed.png`.
- Implementation: Expo's actual web export, served locally on port 4173 and
  opened in headless system Chromium through Playwright. No browser connector
  was available. Screenshots capture the app viewport without browser chrome.
- Primary viewport: **390 × 844 CSS pixels**, deviceScaleFactor **1**; captures
  are 390 × 844 pixels. Both reference images are **853 × 1844 pixels** and were
  downsampled to 390 × 844 for comparison, with subpixel rounding of height.
- Secondary viewport: **375 × 667**, density 1. The app is genuinely responsive;
  it is not a scaled screenshot. Native safe areas are supplied by iOS and are
  absent in this browser, so the entry reference's approximately 44 px blank
  upper inset is not a pixel-position target for this capture.
- State: light entry, export help collapsed; first Spanish sample card with
  answer revealed and sound muted. Reference entry has Help, whereas anonymous
  entry offers Sign in. Reference feed shows a signed-in deck; the capture
  intentionally labels Sample and Exit, without account settings. Compare the
  common body/card surfaces, not these different account controls or counts.

Evidence in `docs/design/ios-v1/implementation/`:

| Artifact | Purpose |
| --- | --- |
| `entry-comparison-before.png` | Combined reference/earlier implementation; undersized teaser and headline |
| `entry-comparison.png` | Combined reference/final entry capture |
| `feed-comparison.png` | Combined reference/revealed sample capture |
| `sources-detail.png` | Focused comparison of inline icons, content and Coming soon labels |
| `entry.png`, `entry-notes.png` | Top and scrolled entry states |
| `feed-hidden.png`, `feed-revealed.png` | Reveal-before-rating and revealed controls |
| `feed-small.png` | 375 × 667 answer/rating layout |
| `web-handoff.png`, `sample-complete.png` | Web explanation and sample completion |

The combined full-view and focused images were opened and visually inspected;
the assessment is not based on file paths, source code or successful builds alone.

## Findings and comparison history

1. **[P2, resolved] Entry teaser was too small.** The first combined comparison
   showed a broad, shallow illustration that weakened the notes-to-feed story.
   Replaced it with a taller standalone transparent illustration, adjusted the
   container to its 1.85:1 ratio, and tightened entry spacing. The final combined
   capture shows both cards at nearly the full content width, with a legible
   note, arrow and illustrated result.
2. **[P2, resolved] Display hierarchy and source marks drifted.** Entry's initial
   42 px headline was smaller than the normalized reference. It now uses Archivo
   Black at 48/50 with tighter surrounding spacing. Focused inspection also
   caught a flattened italki logo and a missing external-link text glyph. The
   original italki SVG is now correctly rasterized with its real colors, and
   Feather supplies the external-link icon. The final focused capture verifies
   the tiny inline treatment instead of a separate logo grid.
3. **[P0 usability, resolved during initial preview] Image intrinsic dimensions
   and decorative rules could overflow the screen.** The teaser now has an
   explicit responsive height, the feed image has explicit full-screen sizing,
   and the rule layer clips inside its absolute container. Final viewport
   measurements find no horizontal overflow. The small-screen rating row remains
   within the viewport with at least 44 px touch targets.

No actionable P0/P1/P2 differences remain in the **shared-screen comparison**.

## Required fidelity surfaces

- **Fonts/typography:** real Archivo 500/700/900 files, with system fallback for
  non-Latin scripts. Entry has the bold two-line headline; feed has a 56 px word,
  25 px meaning, 20 px example and quieter translation. Larger live text than
  some mockup footer copy is intentional for readability. No screenshot text is
  used as product controls. Native font scaling/VoiceOver remains a device check.
- **Spacing/layout:** 24 px content gutters, a compact entry rhythm, one primary
  import CTA and secondary help/sample links. The full-screen card keeps meaning,
  example, audio and four named ratings anchored toward the bottom. Long answers
  scroll without a vertical swipe accidentally rating them. Native safe areas,
  different auth controls and 44 px minimum targets explain the remaining
  positional differences. The notes section reflows and scrolls instead of
  shrinking to fit all its copy into the mockup's fixed image.
- **Colors/tokens:** white `#FFFFFF`, navy `#14213D`, blue `#2346B8`, ruled blue
  `#E6ECF7`, red `#C8372D`, yellow `#F5D90A`. Good is blue; the word in the example
  is yellow. Navy shading keeps the feed readable. Earlier orange/off-white
  colors are absent. The line spacing/shade are live styles, not a raster UI.
- **Image quality/assets:** real Schwanki lockup/goose, proper format marks,
  separate notes illustration and full-bleed goose scene. The new scene preserves
  the hammock, sunglasses, papel picado, skyline and nap motif; it is newly
  generated artwork rather than an exact extraction. Its foreground provides
  room for live card content. UI icons use Feather. No controls, screen frames
  or entire screenshots are used as background replacements for live UI.
- **Copy/content:** “Doomscroll your vocab.”, messy notes/PDF/Anki promise,
  native import/export help, three-card sample, same-account web explanation and
  Coming soon labels are present. Docs, Sheets, PDF, screenshots, PowerPoint,
  Canva and italki stay inline with their text. Future integrations have no
  working Connect action. The native import is explicitly a one-time transfer.

## Interaction and console checks

`qa/smoke.mjs` ran against the latest export at both viewport sizes. It checked
export-help expansion, web-sheet open/close, the scrolled source section, disabled
ratings before reveal, all three sample cards with named ratings, completion,
unconfigured sign-in feedback and small-screen controls. Latest run: **passed**,
**zero page errors and zero console errors**. Spanish autoplay was muted for the
main visual capture because headless Linux lacks a Spanish speech voice.

## Follow-up polish and unverified native behavior

- **[P3]** Replace the generic inline chat icon beside Preply with an official
  reusable brand mark. Its explicit text and Coming soon status already identify
  the platform; no fake brand logo was drawn.
- **[P3]** Device-specific optical spacing and the yellow highlight's padding can
  be refined after seeing native text rendering. The exact generated artwork
  differs from the reference while retaining its subject and art direction.
- Native OAuth, Files selection/import, Keychain, notification delivery, actual
  audio playback, gestures, performance, safe areas and accessibility require
  Xcode/a physical iPhone. See `docs/ios-implementation.md`; these are not covered
  by this browser visual pass. No live Supabase account flow was claimed.

## Implementation checklist

- [x] Correct teaser and typography; recapture and inspect combined comparisons.
- [x] Verify source marks at readable scale in a focused comparison.
- [x] Exercise shared-screen sample, help and web navigation; check console.
- [x] Verify small viewport and persistent rating reachability.
- [ ] Complete the documented native acceptance checks before TestFlight.

final result: passed
