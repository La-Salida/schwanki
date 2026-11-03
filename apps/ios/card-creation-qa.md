# Native card creation

The entry action is **Add your words**. Anki is one of the choices, alongside
starter sets, pasted words/notes, photos, PDF/PowerPoint, Google Docs/Sheets and
Canva PDFs. A selected method and language survive Google sign-in.

Ten bundled first words are available for Spanish, Chinese, Thai, French,
German, Japanese, Korean and English. Their meanings are in English. Starter
sets and explicit word–meaning pairs do not call extraction or generation.
Existing words retain their learning progress. Starting review selects the new
deck, or all decks if every word already existed.

Documents use the deployed source-files/sync/parse pipeline. Native uploads use
ArrayBuffer, retain their content type and checkpoint an owned copy before
upload. Interrupted uploads can resume from Check new words. Pictures are JPEGs
with a longest edge of 2400px. PPTX parsing preserves slide/paragraph order,
discards media and limits archive/XML sizes. Empty/failed parses have terminal
messages. The native inbox supports edits, individual/batch approval and skip.

Google's existing browser picker handles file grants; after saving a source,
return to the native inbox. No broader Drive permission or new web deployment
is required. Canva needs an exported PDF, as on the web.

Validation:

- 58 iOS unit/component tests; whole-workspace typecheck.
- Browser smoke: 390×844, 375×667, 320×568; pinned starter action and no page errors.
- Mocked end-to-end: signed-in Thai starter set saves ten cards and schedules,
  selects its deck, and reaches the real SQLite-backed review feed. All backend
  requests are intercepted; no production account writes or generation calls.
  A newly completed higher-confidence parse preserves the active inbox word and
  its unsaved edits; approving it saves the edited meaning.
- Native Release simulator checks and TestFlight receipt: see testflight-status.json.

Reproduce browser checks from apps/ios:

1. `EXPO_NO_DOTENV=1 corepack pnpm exec expo export --platform web --output-dir dist-web-qa`
2. `python3 qa/serve-preview.py` (localhost:4184, SQLite isolation headers).
3. `PREVIEW_URL=http://127.0.0.1:4184 corepack pnpm test:ui`
4. `node qa/creation-smoke.mjs`

Set PLAYWRIGHT_CHROMIUM_EXECUTABLE if the default installed Chromium is absent.
For the native keyboard check, set `NATIVE_QA_MODE=creation-layout` with the
normal simulator-test command in RUNBOOK.md. iOS 27’s remote Files picker may
omit controls from idb’s accessibility tree; a full picker-cancel check needs an
unlocked Mac and an observed close control.

On a heavily loaded Mac, use `corepack pnpm exec vitest run --maxWorkers=1`.
Sandbox checkout and the complete production Google-consent/import flow are
separate acceptance checks; mocked tests do not certify those services.
