# Sources expansion: PDFs, Canva links, edit & remove

Date: 2026-10-04
Status: approved design (pre-plan)

## 1. Goal

The Sources tab today only accepts Google Doc/Sheet links, offers no way to
edit or remove a source, and `pdf_upload` exists in the schema but has no
ingestion path. This change makes Sources support:

- **PDF upload** — first-class source type, re-uploadable with incremental diffing
- **Canva links** — paste the design link as reference, then drop the exported
  PDF; content comes from the PDF, never from scraping Canva
- **Edit** — label + language only
- **Remove** — user picks the fate of produced content at removal time

This revises the original v1 cut ("no direct Canva connector — Canva content
arrives as PDFs", `2026-09-23-schwanki-design.md` §132): Canva links become a
first-class *reference* on a PDF source; ingestion is still PDF-based, so no
Canva scraping/API is introduced.

## 2. Architecture

The PDF path plugs into the existing pipeline at exactly one new point: where
content is fetched. Everything downstream is untouched.

```
Upload / Update PDF          Re-sync
     │                          │
     ▼                          ▼
Supabase Storage bucket "source-files"
  path: {user_id}/{source_id}.pdf
     │                          │
     └──────► sync-pdf edge function ◄── "Sync now" / cron
                  │  1. fetch file from Storage
                  │  2. extract text (server-side)
                  │  3. sha256 → unchanged? done
                  │  4. diff added lines vs latest snapshot
                  │  5. insert llm_jobs {type:"parse", chunk}
                  │  6. write snapshot, advance hash
                  ▼
        parse-worker (existing, unchanged)
                  ▼
        candidate_cards → Inbox → deck
```

Steps 3–6 replicate `sync-google`'s `syncOne` diff/snapshot/hash logic
verbatim, including the abort-before-advance ordering guarantees (a failed
`snapshot` or `llm_jobs` insert must not leave hash and snapshot desynced).

`parse-worker`, the dedup layers, and the Inbox need no changes: a
`pdf_upload` chunk flows through the parsing orchestrator's "everything else →
LLM" tier.

**Approach chosen:** server-side extraction in a new `sync-pdf` function,
file retained in Storage. Rejected: client-side pdf.js extraction (device
cost, version drift, file uploaded anyway) and generalizing `sync-google`
into one function (touches a proven path for no immediate benefit; merge
later once PDF sync is battle-tested).

### Storage

New migration `0002_source_files.sql`:

- Storage bucket `source-files`, private
- RLS policies on `storage.objects` scoped to the owner's prefix
  (`{user_id}/...`) for select/insert/update/delete
- Object path derived from the source id: `{user_id}/{source_id}.pdf` — no
  file-path column needed

## 3. Data model

### `external_ref` for `pdf_upload`

Human-facing reference, no schema change:

- Canva-backed source → the Canva design URL
- Plain PDF upload → the original filename

### Fix: `candidate_cards.source_id` delete behavior (new migration)

Current schema: `source_id uuid not null references sources(id) on delete
cascade` — deleting a source silently destroys its pending Inbox candidates,
which breaks the "keep cards" removal mode. Migration:

- drop `not null`, change FK to `on delete set null`

Inbox rows with `source_id = null` render with a neutral fallback icon/label
(e.g. 📎 "Removed source"). Deck-level dedup in `parse-worker` is unaffected;
the per-source pending-candidate dedup query simply doesn't match orphaned
rows (acceptable: their accepted counterparts are still caught by the deck
layer, and a removed source produces no new parses).

`cards.source_id` already uses `on delete set null` — no change.

## 4. Sources page UI

### Add form — three modes

Mode switch (tabs/chips): **Google link** | **PDF upload** | **Canva + PDF**

- Google: paste-link input as today; `detectSourceType` detection (📊/📄)
  unchanged
- PDF: drop zone / file picker
- Canva: Canva-link input + "Export as PDF and drop it here" drop zone
- All modes share the label input and language select

`detectSourceType` gains a `canva` match (`canva.com/design/...`); the
existing test asserting Canva links return `null` is replaced (that assertion
encoded the old v1 cut).

### Source list rows

- Google rows: "Sync now" as today
- PDF/Canva rows: "Update PDF" (file picker → upload → `sync-pdf` → navigate
  to Inbox); Canva link rendered as a clickable reference under the label
- ✏️ inline edit of label + language (save/cancel)
- 🗑 removal dialog (below)
- Rows show 🎨 + link when a `pdf_upload` source's `external_ref` matches a
  Canva URL; no new `SourceType`, no new entries in `SOURCE_ICON` beyond a
  derived display helper

### Removal dialog

Radio choice, default the safe option:

1. **Keep everything it produced** — accepted cards + Inbox candidates stay
   (candidates orphaned to `source_id = null` via the migration above)
2. **Remove its Inbox candidates too** — accepted cards stay
3. **Remove everything** — accepted cards, candidates, the lot

All modes delete the source row, its snapshots (cascade), and the Storage
object for PDFs.

## 5. API surface (`SchwankiApi`, packages/core)

- `updateSource(id, { label?, language? })` — row update; RLS scopes to owner
- `removeSource(id, mode: "keep" | "drop_pending" | "drop_all")` — client-side
  sequence, no new edge function:
  - `drop_pending`: delete `candidate_cards` where `source_id` and
    `status='pending'`
  - `drop_all`: additionally delete `cards` where `source_id`
  - all modes: delete Storage object (PDFs), then delete the source row
- `uploadSourcePdf(sourceId, file)` — `storage.from("source-files").upload(
  {user_id}/{sourceId}.pdf, file, { upsert: true })`

Creation flow (PDF/Canva): `addSource({ type: "pdf_upload", externalRef:
canvaUrl | filename, ... })` → upload file → invoke `sync-pdf` → navigate to
Inbox. On upload/sync failure the row stays with `status: "error"`, visible
in the list, retriable via "Update PDF".

## 6. Error handling

- `sync-pdf` mirrors `sync-google`'s per-source failure isolation: on error,
  mark the source `status: "error"` with `error_detail`, continue with other
  sources, return `failed:<message>` per source
- PDF with no extractable text (scanned/image-only) → `status: "error"`,
  `error_detail` explains no text layer was found; row stays visible and
  retriable
- Network failures during file fetch/extraction → transient `error`, retried
  by cron or manual "Sync now"
- Auth: manual invocation verifies the caller owns the source (same JWT check
  as `sync-google`); cron path requires the service-role bearer
- File size guard: reject uploads > 10 MB client-side before upload

## 7. Testing

- **parsing package**: PDF text extraction fixtures (sample PDFs with tables,
  prose, CJK); extracted text feeds the existing orchestrator tier tests
- **core API tests**: `updateSource`, `removeSource` in all three modes
  (asserting candidate/card survival per mode), `uploadSourcePdf` path
  derivation
- **web unit tests**:
  - `detectSourceType` — Canva URL variants (`canva.com/design/...`, with
    query params); Google detection unchanged
  - `SourceForm` — three modes, validation errors (PDF mode without file,
    Canva mode without link or file)
  - Sources page — row actions per type, removal dialog modes
- **integration**: `sync-pdf` end-to-end against a Storage fixture — first
  sync enqueues a parse job, re-upload of a modified PDF diffs only added
  lines, identical re-upload returns `unchanged`
- **regression**: `sync-google` untouched; its tests keep passing

## 8. Explicitly out of scope

- Scraping or API-integrating Canva (fragile, ToS-grey; PDF export covers it)
- OCR for scanned/image-only PDFs
- Editing a source's link or file reference (re-pointing) — remove + re-add
- Preply chat / manual source ingestion (existing placeholders, separate work)
- Merging `sync-google` and `sync-pdf` into one function (deferred refactor)
