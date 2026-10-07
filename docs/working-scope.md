# Schwanki working scope

Updated: October 7, 2026.

The goal is to review flashcards made from the learner's own instructors' class
materials. Finish this workflow before adding other learning features.

## Actual instructors

- Chinese teacher 1: shared Google Sheets. Connected in the test account;
  vocabulary import has succeeded (confirmed by the learner).
- Chinese teacher 2: a new PDF after each class. This is the next integration.
  Example: `26-4-14_class_note.pdf`, a Chinese lesson dated April 14, 2026.
- Japanese teacher: supplies vocabulary through chat, without documents.
  Keep this use case for later. Chat import is deferred; it does not require
  pursuing class recording or transcription now.

## Current delivery slice: class PDFs

- Upload one PDF per class; keep earlier classes and their files.
- Identify the teacher and class date before importing. A date suggested from
  the filename stays editable; it must not be replaced by the upload date.
- Reuse the existing source, parsing, Inbox, and spaced-repetition paths.
  Store each class as a separately labelled PDF source, so existing review
  filtering already selects a single class. No new schema is required.
- Show the class label in the Inbox and review screen.
- Keep teacher wording and English glosses. When the notes lack an English
  meaning, suggest a translation at lower confidence for learner approval.
- Extract selected vocabulary and phrases, rather than turning every sentence
  of a lesson dialogue into a flashcard. Keep matching teacher examples.
- Retry a PDF parse when the language-model provider is missing or fails;
  never silently complete an import with no cards because of a provider error.
- Keep manual upload as the first complete path. Automatic retrieval depends
  on how the teacher delivers the files; do not assume a Preply connector.

## Deferred

Japanese chat import, recording/transcription, listening packs, and additional
mnemonic/media features. Do not expand them while finishing document imports.

## Sample inspection

The existing PDF extractor reads the sample's Chinese text and inline English
glosses. Some pinyin printed above the characters is absent from the PDF text
extraction. Preserve readings that are available; do not claim all displayed
pinyin has been recovered. Keep the original private document outside Git.

## Finish line

Upload this teacher's class PDF, check the suggested vocabulary in the Inbox,
approve it, and review that class without developer intervention. Validate the
real account flow before calling the integration released.

## Validation on October 7, 2026

- All 192 workspace tests pass on the PDF branch based on `origin/main`.
- Workspace type checking, web build and lint, Edge parse-worker source check,
  and whitespace checks pass. Existing lint/build warnings remain.
- Inspected all five sample PDF pages and ran its bytes through the existing
  PDF extractor. The extracted text includes 来不及, 舍不得, 强烈推荐, 明显,
  and 肌肉线条; the filename suggests the correct class date in the browser.
- Parser tests use a recorded mock response. They cover PDF-specific routing,
  preservation of supplied content, deduplication, and retries on provider
  failures; they do not certify the quality of a live model response.
- Live model extraction and upload/approval/review in the learner's test account
  remain release acceptance checks after deployment approval.
