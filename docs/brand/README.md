# Schwanki brand kit

Schwanki is a modern take on Anki: spaced repetition that scrolls like a feed and ends.
The Chaos Goose stole your vocab notebook and is smug about it. Everything below serves that.

Voice and copy rules live in [copy.md](copy.md). Interface direction lives in [DESIGN.md](../../DESIGN.md).

## Logo

| Asset | File | Use it for |
|---|---|---|
| App mark | `logo/schwanki-mark-1024.png` | App icons, favicons, avatars, anywhere square and small |
| App mark, full bleed | `logo/schwanki-mark-square-1024.png` | Platforms that round or crop the corners themselves (iOS, Android maskable, social avatars) |
| Wordmark | `logo/schwanki-wordmark-{ink,cream,beak}.svg` | Text-only placements; vector, scales to any size |
| Lockup | `logo/schwanki-lockup-{ink,cream}.png` | Headers, decks, press. `ink` on light backgrounds, `cream` on dark |

- **The mark** is the goose's head biting the VOCAB notebook, cropped so it bleeds off the bottom and right of an ink square. The crop is the point: he's mid-heist.
- **The wordmark** is "Schwanki" set in Archivo Black (900) at −2.5% tracking, outlined to paths. Don't retype it in another font.
- **Clear space:** keep at least the height of the wordmark's "S" free on every side.
- **Minimum size:** mark 16 px; wordmark 20 px tall on screen; lockup 120 px wide.
- **Spelling:** Schwanki, capital S. Lowercase "schwanki" only in casual copy. Never "Schwanki App".

Don't recolor the goose, put the mark on a busy photo, stretch or rotate the wordmark, add effects (glow, gradient, outline), or redraw the mascot with AI. Use the files.

## Color

| Token | Hex | Role |
|---|---|---|
| Cream | `#FAF6EF` | Paper surface. The default background |
| Ink | `#1A1712` | Text, the app mark's square, dark surfaces |
| Beak | `#B83D1C` | Primary actions, eyebrows, links. One per view |
| Acid | `#F5D90A` | Highlighter marks behind a word. Sparingly |
| Mint / Lilac / Sky / Blush | `#B8E0D2` `#D6C6E8` `#A8D0E6` `#F4C6D0` | Deck and language tags only |

Contrast (WCAG): ink on cream 16.6:1, beak on cream 5.2:1 (AA for body text), ink on acid 12.6:1.
Beak on ink is only 3.2:1, so don't set beak text on ink; use cream.

## Type

**Archivo**, from Google Fonts. 900 for headlines and the wordmark, 700 for buttons and eyebrows, 500 for body.
Headlines are tight (line-height ~1.05, tracking −2.5%). Eyebrows are 700, uppercase, +14% tracking, in beak.

## Mascot

The Chaos Goose: white goose, leather jacket with a smiley pin, orange beak and feet, purple VOCAB notebook.
Source art: `mascot/chaos-goose-cutout-1024.png` (transparent). He's smug, not angry. He judges; he never threatens.

Generated memory-aid pictures follow the same bold cartoon style and never contain words.

## Social cards

1200×630 JPEGs, one per public page, in `apps/web/public/og/`. Layout: cream left with the lockup,
a beak eyebrow, a 76 px Archivo Black headline with one acid-highlighted word, a short subline and the URL;
on the right, the goose over an ink slab with a beak offset edge.
To add a page: add its entry to `PAGES` in `apps/web/src/lib/seo.ts`, add a card in `tools/render.js`, and add the URL to `apps/web/public/sitemap.xml` (a test checks the last two agree).

## Regenerating the assets

`tools/` holds the scripts that made every file here: `mark.js` (app mark and icons), `wordmark.js`
(SVG wordmark), `render.js` (lockups and social cards, via Playwright). Run them from a scratch folder with
`sharp`, `opentype.js`, `@fontsource/archivo`, `png-to-ico` and `playwright` installed, and with
`mascot/chaos-goose-cutout-1024.png` copied in as `goose-1024.png`.
