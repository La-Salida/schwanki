# Asset sources

- `lockup.png`, `goose.png`, `icon.png`: existing Schwanki brand assets from
  `docs/brand` and `apps/web/public`.
- `demo/feed-ja.jpg`, `demo/goose-steals-homework.jpg`, and Japanese/Chinese MP3s:
  existing web sample content from `apps/web/public/demo`. Audio matches the
  displayed sentence. The Spanish sample uses iOS speech synthesis.
- `notes-to-feed.png`: generated standalone transparent illustration, grounded
  in the approved entry design. Labels inside the pictured notes/card are artwork;
  all surrounding product copy and controls are live React Native components.
- `demo/siesta.png`: generated standalone goose-in-a-hammock image, with open
  foreground for live card text. No UI, phone frame or rating controls are baked in.
- `icons`: source vector marks rasterized during the approved visual study.
  Source URLs are recorded in
  `docs/design/ios-v1/visual-study-04/references/sources.txt`. Google Docs/Sheets
  and Canva: Simple Icons; PDF/PowerPoint/image file: Material Icon Theme;
  italki: dashboard-icons. Preply uses Feather's generic message-square until an
  official asset is available. Brand marks identify input formats/platforms;
  they do not imply affiliation.
- Archivo 500/700/900 is bundled by `@expo-google-fonts/archivo` (OFL); interface
  symbols use Feather through `@expo/vector-icons` (MIT).

Approved screenshots in `docs/design/ios-v1/approved` are visual references,
never runtime screen assets.
