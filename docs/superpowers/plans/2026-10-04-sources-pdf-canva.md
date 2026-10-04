# Sources Expansion (PDF, Canva, Edit & Remove) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add PDF uploads and Canva-link-backed PDFs as vocabulary sources (re-uploadable with incremental diffing), and edit or remove any source from the Sources tab.

**Architecture:** A new `sync-pdf` edge function fetches uploaded PDFs from a private `source-files` Storage bucket, extracts text server-side (pdf.js legacy build), then runs the exact diff → snapshot → `llm_jobs` pipeline `sync-google` already uses. The web app gains a three-mode SourceForm (Google link / PDF / Canva + PDF) and per-row edit/remove actions; removal offers keep-cards / drop-pending / drop-all.

**Tech Stack:** React 19 + Vite + Tailwind (apps/web, vitest + jsdom), Supabase (Postgres + Storage + Deno edge functions), pnpm workspace (`packages/core`, `packages/parsing`), pdfjs-dist 4.x legacy build in Deno.

**Spec:** `docs/superpowers/specs/2026-10-04-sources-pdf-canva-design.md`

## Global Constraints

- `pdf_upload` is already a valid `SourceType` in TS and the DB check constraint — do NOT add a `canva` source type; Canva-backed sources are `pdf_upload` rows whose `external_ref` is the Canva URL.
- Storage object path is always derived: `{user_id}/{source_id}.pdf` in bucket `source-files`. Never store file paths in the DB.
- Edit covers **label + language only**. Never re-point `external_ref`.
- `sync-google`, `parse-worker`, and `packages/parsing` stay behaviorally unchanged; their tests must keep passing.
- After ANY change under `packages/*/src`, run `scripts/vendor-edge.sh` and commit the regenerated `supabase/functions/_vendor` (checked by `scripts/check-vendor.sh`).
- Test commands: web/core/parsing → `pnpm -r --if-present test` (vitest); edge functions → `cd supabase/functions && deno test`.
- Spec refinement discovered during planning: the Inbox (Triage/CandidateRow) renders no per-candidate source info, so the spec's "📎 Removed source" Inbox fallback needs no UI work — the FK migration alone preserves orphaned candidates.

---

### Task 1: Canva link detection in `detectSource`

**Files:**
- Modify: `apps/web/src/lib/detectSource.ts`
- Test: `apps/web/src/lib/detectSource.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `detectSourceType(url: string): "google_sheet" | "google_doc" | "canva" | null` — Task 5's SourceForm branches on this.
  - `isCanvaRef(externalRef: string): boolean` — Task 6's Sources page uses it to render the 🎨 Canva reference under a `pdf_upload` row.

- [ ] **Step 1: Rewrite the failing test**

Replace the whole of `apps/web/src/lib/detectSource.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectSourceType, isCanvaRef } from "./detectSource";

describe("detectSourceType", () => {
  it("detects sheets", () => {
    expect(detectSourceType("https://docs.google.com/spreadsheets/d/1NvH/edit?usp=sharing")).toBe("google_sheet");
  });
  it("detects docs", () => {
    expect(detectSourceType("https://docs.google.com/document/d/1zyD/edit?tab=t.0")).toBe("google_doc");
  });
  it("detects canva design links", () => {
    expect(detectSourceType("https://www.canva.com/design/DAF123abc/view?utm_content=DAF123abc")).toBe("canva");
    expect(detectSourceType("https://canva.com/design/x")).toBe("canva");
  });
  it("rejects anything else", () => {
    expect(detectSourceType("https://example.com/file.pdf")).toBeNull();
    expect(detectSourceType("not a url")).toBeNull();
  });
});

describe("isCanvaRef", () => {
  it("matches canva design urls", () => {
    expect(isCanvaRef("https://www.canva.com/design/DAF123abc/view")).toBe(true);
  });
  it("rejects filenames and other urls", () => {
    expect(isCanvaRef("lesson-3.pdf")).toBe(false);
    expect(isCanvaRef("https://docs.google.com/spreadsheets/d/1NvH")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/web test`
Expected: FAIL — `isCanvaRef is not a function` / canva cases return `null`

- [ ] **Step 3: Implement**

Replace the whole of `apps/web/src/lib/detectSource.ts`:

```ts
import type { SourceType } from "@schwanki/core";

export type DetectedSourceType = Extract<SourceType, "google_sheet" | "google_doc"> | "canva";

const CANVA_RE = /(?:^|\/\/)(?:www\.)?canva\.com\/design\//;

export function detectSourceType(url: string): DetectedSourceType | null {
  if (/docs\.google\.com\/spreadsheets\//.test(url)) return "google_sheet";
  if (/docs\.google\.com\/document\//.test(url)) return "google_doc";
  if (CANVA_RE.test(url)) return "canva";
  return null;
}

/** Is this external_ref a Canva design link? (pdf_upload rows store either a Canva URL or a filename.) */
export function isCanvaRef(externalRef: string): boolean {
  return CANVA_RE.test(externalRef);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @schwanki/web test`
Expected: PASS (all detectSource tests green; unrelated suites untouched)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/detectSource.ts apps/web/src/lib/detectSource.test.ts
git commit -m "feat(web): detect Canva design links in detectSource"
```

---

### Task 2: Migration — `source-files` bucket, candidate_cards FK fix, sync-pdf cron

**Files:**
- Create: `supabase/migrations/0009_source_files.sql`

**Interfaces:**
- Consumes: existing `sources`, `candidate_cards` tables (0001), storage policy pattern (0005), `call_edge_function` helper (0002).
- Produces: bucket `source-files` (Task 3 uploads into it; Task 4 downloads from it); `candidate_cards.source_id` nullable with `on delete set null` (Task 3's `removeSource` "keep" mode relies on it); cron job `sync-pdf-cron`.

- [ ] **Step 1: Write the migration**

```sql
-- Sources expansion: PDF file storage, orphan-safe candidate_cards, sync-pdf cron

-- Private bucket for uploaded PDFs; objects live at {user_id}/{source_id}.pdf
insert into storage.buckets (id, name, public) values ('source-files', 'source-files', false);

create policy "read own source files" on storage.objects for select
  using (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "write own source files" on storage.objects for insert
  with check (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "update own source files" on storage.objects for update
  using (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "delete own source files" on storage.objects for delete
  using (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- "Keep cards" source removal must not cascade-delete Inbox candidates:
-- orphan them instead (cards.source_id already behaves this way).
alter table candidate_cards alter column source_id drop not null;
alter table candidate_cards drop constraint candidate_cards_source_id_fkey;
alter table candidate_cards
  add constraint candidate_cards_source_id_fkey
  foreign key (source_id) references sources(id) on delete set null;

-- PDF re-sync poll every 6 h, offset from the google poll
select cron.schedule('sync-pdf-cron', '41 */6 * * *', $$select call_edge_function('sync-pdf')$$);
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset` (local stack; reapplies all migrations including seed)
Expected: reset completes without errors. Then verify in SQL (`supabase db shell` or Studio):

```sql
select id, public from storage.buckets where id = 'source-files';           -- 1 row, public = false
select is_nullable from information_schema.columns
  where table_name = 'candidate_cards' and column_name = 'source_id';        -- YES
select jobname from cron.job where jobname = 'sync-pdf-cron';                -- 1 row
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_source_files.sql
git commit -m "feat(db): source-files bucket, orphan-safe candidate_cards, sync-pdf cron"
```

---

### Task 3: Core API — `updateSource`, `removeSource`, `uploadSourcePdf`

**Files:**
- Modify: `packages/core/src/api.ts`
- Test: `packages/core/src/sources-api.test.ts` (create)

**Interfaces:**
- Consumes: bucket `source-files` and FK behavior from Task 2 (at runtime; unit tests use a fake client).
- Produces (used by Tasks 5 & 6 via the `api` singleton):
  - `sourceFilePath(userId: string, sourceId: string): string` — pure, exported standalone; returns `{userId}/{sourceId}.pdf`.
  - `api.updateSource(id: string, patch: { label?: string; language?: string }): Promise<void>`
  - `api.removeSource(id: string, mode: "keep" | "drop_pending" | "drop_all"): Promise<void>`
  - `api.uploadSourcePdf(sourceId: string, file: Blob): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/sources-api.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SchwankiApi, sourceFilePath } from "./api.ts";

/* Minimal chainable fake for the supabase-js query builder. */
type Result = { data?: unknown; error?: { message: string; code?: string } | null };
function queryStub(result: Result = { data: null, error: null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const self: Record<string, unknown> = {
    calls,
    then: (resolve: (r: Result) => void) => resolve(result),
  };
  for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "in", "order", "limit"]) {
    self[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return self; };
  }
  for (const m of ["single", "maybeSingle"]) {
    self[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return Promise.resolve(result); };
  }
  return self as unknown as {
    calls: Array<{ method: string; args: unknown[] }>;
    select: (...a: unknown[]) => unknown; insert: (...a: unknown[]) => unknown;
    update: (...a: unknown[]) => unknown; delete: (...a: unknown[]) => unknown;
    eq: (...a: unknown[]) => unknown; single: () => Promise<Result>;
  };
}

function fakeClient(opts: {
  userId?: string;
  queries?: Record<string, ReturnType<typeof queryStub>>;
  storageCalls?: Array<{ method: string; args: unknown[] }>;
}) {
  const queries = opts.queries ?? {};
  const storageCalls = opts.storageCalls ?? [];
  return {
    auth: { getUser: async () => ({ data: { user: opts.userId ? { id: opts.userId } : null } }) },
    from: (table: string) => queries[table] ?? queryStub(),
    storage: {
      from: (bucket: string) => ({
        upload: async (...args: unknown[]) => { storageCalls.push({ method: `${bucket}.upload`, args }); return { error: null }; },
        remove: async (...args: unknown[]) => { storageCalls.push({ method: `${bucket}.remove`, args }); return { error: null }; },
      }),
    },
  } as unknown as SupabaseClient;
}

describe("sourceFilePath", () => {
  it("derives the storage path from user and source id", () => {
    expect(sourceFilePath("u1", "s1")).toBe("u1/s1.pdf");
  });
});

describe("updateSource", () => {
  it("patches only the given fields, scoped by id", async () => {
    const sources = queryStub({ data: null, error: null });
    const api = new SchwankiApi(fakeClient({ queries: { sources } }));
    await api.updateSource("s1", { label: "New label" });
    expect(sources.calls).toContainEqual({ method: "update", args: [{ label: "New label" }] });
    expect(sources.calls).toContainEqual({ method: "eq", args: ["id", "s1"] });
  });
});

describe("removeSource", () => {
  const sourceRow = { id: "s1", user_id: "u1", type: "pdf_upload" };

  it("keep: deletes only the source row and storage object", async () => {
    const queries = {
      sources: queryStub({ data: sourceRow, error: null }),
      candidate_cards: queryStub(), cards: queryStub(),
    };
    const storageCalls: Array<{ method: string; args: unknown[] }> = [];
    const api = new SchwankiApi(fakeClient({ userId: "u1", queries, storageCalls }));
    await api.removeSource("s1", "keep");
    expect(queries.candidate_cards.calls.filter((c) => c.method === "delete")).toHaveLength(0);
    expect(queries.cards.calls.filter((c) => c.method === "delete")).toHaveLength(0);
    expect(storageCalls).toContainEqual({ method: "source-files.remove", args: [["u1/s1.pdf"]] });
    expect(queries.sources.calls).toContainEqual({ method: "delete", args: [] });
  });

  it("drop_pending: also deletes pending candidates", async () => {
    const queries = {
      sources: queryStub({ data: sourceRow, error: null }),
      candidate_cards: queryStub(), cards: queryStub(),
    };
    const api = new SchwankiApi(fakeClient({ userId: "u1", queries }));
    await api.removeSource("s1", "drop_pending");
    expect(queries.candidate_cards.calls).toContainEqual({ method: "delete", args: [] });
    expect(queries.candidate_cards.calls).toContainEqual({ method: "eq", args: ["status", "pending"] });
    expect(queries.cards.calls.filter((c) => c.method === "delete")).toHaveLength(0);
  });

  it("drop_all: also deletes cards", async () => {
    const queries = {
      sources: queryStub({ data: sourceRow, error: null }),
      candidate_cards: queryStub(), cards: queryStub(),
    };
    const api = new SchwankiApi(fakeClient({ userId: "u1", queries }));
    await api.removeSource("s1", "drop_all");
    expect(queries.cards.calls).toContainEqual({ method: "delete", args: [] });
    expect(queries.cards.calls).toContainEqual({ method: "eq", args: ["source_id", "s1"] });
  });

  it("non-PDF source: no storage removal", async () => {
    const queries = { sources: queryStub({ data: { ...sourceRow, type: "google_sheet" }, error: null }) };
    const storageCalls: Array<{ method: string; args: unknown[] }> = [];
    const api = new SchwankiApi(fakeClient({ userId: "u1", queries, storageCalls }));
    await api.removeSource("s1", "keep");
    expect(storageCalls).toHaveLength(0);
  });
});

describe("uploadSourcePdf", () => {
  it("uploads to the derived path with upsert", async () => {
    const storageCalls: Array<{ method: string; args: unknown[] }> = [];
    const api = new SchwankiApi(fakeClient({ userId: "u1", storageCalls }));
    const file = new Blob(["%PDF"], { type: "application/pdf" });
    await api.uploadSourcePdf("s1", file);
    expect(storageCalls).toContainEqual({
      method: "source-files.upload",
      args: ["u1/s1.pdf", file, { upsert: true, contentType: "application/pdf" }],
    });
  });

  it("throws when not signed in", async () => {
    const api = new SchwankiApi(fakeClient({}));
    await expect(api.uploadSourcePdf("s1", new Blob(["%PDF"]))).rejects.toThrow("not signed in");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/core test`
Expected: FAIL — `sourceFilePath is not exported` / `api.updateSource is not a function`

- [ ] **Step 3: Implement**

In `packages/core/src/api.ts`, add after the `addSource` method (inside `class SchwankiApi`):

```ts
  async updateSource(id: string, patch: { label?: string; language?: string }): Promise<void> {
    const fields: Record<string, string> = {};
    if (patch.label !== undefined) fields.label = patch.label;
    if (patch.language !== undefined) fields.language = patch.language;
    if (Object.keys(fields).length === 0) return;
    const { error } = await this.db.from("sources").update(fields).eq("id", id);
    if (error) throw error;
  }

  /**
   * Remove a source. mode decides the fate of produced content:
   * keep → candidates orphaned (source_id set null by FK), cards untouched
   * drop_pending → pending Inbox candidates deleted first, cards untouched
   * drop_all → pending candidates AND deck cards deleted first
   * Always removes the Storage object (PDFs) and the source row (snapshots cascade).
   */
  async removeSource(id: string, mode: "keep" | "drop_pending" | "drop_all"): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data: source, error: srcErr } = await this.db
      .from("sources").select("id, user_id, type").eq("id", id).single();
    if (srcErr) throw srcErr;
    if (mode !== "keep") {
      const { error } = await this.db.from("candidate_cards").delete()
        .eq("source_id", id).eq("status", "pending");
      if (error) throw error;
    }
    if (mode === "drop_all") {
      const { error } = await this.db.from("cards").delete().eq("source_id", id);
      if (error) throw error;
    }
    if (source?.type === "pdf_upload") {
      const { error } = await this.db.storage.from("source-files")
        .remove([sourceFilePath(user.id, id)]);
      if (error) throw error;
    }
    const { error } = await this.db.from("sources").delete().eq("id", id);
    if (error) throw error;
  }

  async uploadSourcePdf(sourceId: string, file: Blob): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { error } = await this.db.storage.from("source-files")
      .upload(sourceFilePath(user.id, sourceId), file, { upsert: true, contentType: "application/pdf" });
    if (error) throw error;
  }
```

And add the standalone export next to `mapSource` at the bottom of the file:

```ts
/** Storage object path for a source's PDF: {userId}/{sourceId}.pdf */
export function sourceFilePath(userId: string, sourceId: string): string {
  return `${userId}/${sourceId}.pdf`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @schwanki/core test`
Expected: PASS (new suite green, existing core suites untouched)

- [ ] **Step 5: Re-vendor and verify**

```bash
./scripts/vendor-edge.sh && ./scripts/check-vendor.sh
```

Expected: vendor script reports files copied; check passes silently.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/src/sources-api.test.ts supabase/functions/_vendor
git commit -m "feat(core): updateSource, removeSource, uploadSourcePdf"
```

---

### Task 4: `sync-pdf` edge function

**Files:**
- Create: `supabase/functions/sync-pdf/pdf.ts`
- Create: `supabase/functions/sync-pdf/index.ts`
- Create: `supabase/functions/sync-pdf/pdf.test.ts`
- Create: `supabase/functions/sync-pdf/fixtures/hello.pdf` (generated in Step 1)
- Modify: `supabase/functions/deno.json`

**Interfaces:**
- Consumes: bucket `source-files` (Task 2), `addedLines` from `../sync-google/diff.ts` (existing), `llm_jobs`/`source_snapshots`/`sources` tables (existing).
- Produces:
  - `extractPdfText(bytes: Uint8Array): Promise<string>` — page text joined with newlines (`hasEOL` boundaries); throws on unparseable PDF.
  - Edge function `sync-pdf` — invoked manually with `{ sourceId }` (JWT ownership check) or by cron with the service-role bearer; same contract as `sync-google` (`Response.json({ results })`).

- [ ] **Step 1: Generate the PDF test fixture**

Run from the repo root with the managed Python (reportlab is preinstalled):

```bash
python - <<'EOF'
from reportlab.pdfgen import canvas
c = canvas.Canvas("supabase/functions/sync-pdf/fixtures/hello.pdf")
c.drawString(100, 750, "Hello world")
c.drawString(100, 730, "xiexie - thank you")
c.save()
print("fixture written")
EOF
```

Expected: `supabase/functions/sync-pdf/fixtures/hello.pdf` exists (~1–2 KB).

- [ ] **Step 2: Write the failing test**

Create `supabase/functions/sync-pdf/pdf.test.ts`:

```ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { extractPdfText } from "./pdf.ts";

Deno.test("extractPdfText reads text from a real PDF", async () => {
  const bytes = await Deno.readFile(new URL("./fixtures/hello.pdf", import.meta.url));
  const text = await extractPdfText(bytes);
  assertStringIncludes(text, "Hello world");
  assertStringIncludes(text, "xiexie - thank you");
});

Deno.test("extractPdfText rejects non-PDF bytes", async () => {
  let threw = false;
  try {
    await extractPdfText(new TextEncoder().encode("not a pdf"));
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
```

- [ ] **Step 3: Add the pdf.js import map entry**

In `supabase/functions/deno.json`, add to `"imports"`:

```json
    "pdfjs-dist": "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs",
```

(keep the existing entries unchanged)

- [ ] **Step 4: Run test to verify it fails**

Run: `cd supabase/functions && deno test --allow-read sync-pdf/`
Expected: FAIL — `Cannot find module './pdf.ts'`

- [ ] **Step 5: Implement `pdf.ts`**

Create `supabase/functions/sync-pdf/pdf.ts`:

```ts
import { getDocument } from "pdfjs-dist";

// pdf.js touches DOM globals on some code paths even for plain text extraction.
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {};
}

/** Extract readable text from a PDF, one line per text run (EOL-aware). */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({
    data: bytes,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        if ("hasEOL" in item && item.hasEOL) text += "\n";
      }
      pages.push(text);
    }
    return pages.join("\n");
  } finally {
    await doc.destroy();
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd supabase/functions && deno test --allow-read sync-pdf/`
Expected: PASS — both tests green. If pdf.js throws about a missing DOM global other than `DOMMatrix`, stub it the same way in `pdf.ts` and note it in the commit message.

- [ ] **Step 7: Implement `index.ts`**

Create `supabase/functions/sync-pdf/index.ts` (mirrors `sync-google/index.ts`; the diff/snapshot/hash block is intentionally verbatim):

```ts
import { createClient } from "@supabase/supabase-js";
import { addedLines } from "../sync-google/diff.ts";
import { extractPdfText } from "./pdf.ts";

const BUCKET = "source-files";

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

class SyncError extends Error {
  constructor(public kind: "revoked" | "error", message: string) { super(message); }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchContent(source: Record<string, unknown>): Promise<string> {
  const supabase = adminClient();
  const path = `${source.user_id}/${source.id}.pdf`;
  const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !file) throw new SyncError("error", `storage download failed: ${error?.message ?? "empty"}`);
  let text: string;
  try {
    text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    throw new SyncError("error", `pdf extraction failed: ${(e as Error).message}`);
  }
  if (!text.trim()) {
    throw new SyncError("error", "no extractable text — this PDF looks scanned or image-only");
  }
  return text;
}

async function syncOne(source: Record<string, unknown>): Promise<string> {
  const supabase = adminClient();
  const content = await fetchContent(source);
  const hash = await sha256(content);
  if (hash === source.content_hash) {
    await supabase.from("sources")
      .update({ last_synced_at: new Date().toISOString(), status: "active", error_detail: null })
      .eq("id", source.id);
    return "unchanged";
  }

  const { data: snap } = await supabase
    .from("source_snapshots").select("content")
    .eq("source_id", source.id).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  const added = addedLines(snap?.content ?? null, content);

  if (added.length > 0) {
    const { error: jobError } = await supabase.from("llm_jobs").insert({
      type: "parse",
      payload: { source_id: source.id, chunk: added.join("\n") },
    });
    // Abort before advancing the snapshot/hash so the added lines are re-diffed next sync.
    if (jobError) throw new SyncError("error", `llm_jobs insert failed: ${jobError.message}`);
  }
  const { error: snapError } = await supabase.from("source_snapshots").insert({ source_id: source.id, content });
  if (snapError) throw new SyncError("error", `snapshot insert failed: ${snapError.message}`);
  const { error: srcError } = await supabase.from("sources").update({
    last_synced_at: new Date().toISOString(), content_hash: hash, status: "active", error_detail: null,
  }).eq("id", source.id);
  // Snapshot is already written; a failed hash update self-heals on the next sync.
  if (srcError) console.warn(`sources hash update failed for ${source.id}: ${srcError.message}`);
  return `diffed:${added.length}`;
}

Deno.serve(async (req) => {
  const supabase = adminClient();
  const body = await req.json().catch(() => ({})) as { sourceId?: string };

  let query = supabase.from("sources").select("*")
    // Retry transient failures automatically; pdf sources are never "revoked" (no OAuth)
    .eq("type", "pdf_upload").in("status", ["active", "error"]);

  if (body.sourceId) {
    // Manual "sync now": verify the caller owns this source
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    query = query.eq("id", body.sourceId).eq("user_id", user.id);
  } else if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    // Cron path: service-role bearer only
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: sources } = await query;
  const results: Record<string, string> = {};
  for (const source of sources ?? []) {
    try {
      results[source.id] = await syncOne(source);
    } catch (e) {
      // Failure isolation: mark this source, keep going
      const err = e as Error & { kind?: string };
      await supabase.from("sources").update({
        status: err.kind === "revoked" ? "revoked" : "error",
        error_detail: err.message,
      }).eq("id", source.id);
      results[source.id] = `failed:${err.message}`;
    }
  }
  return Response.json({ results });
});
```

- [ ] **Step 8: Verify the function compiles and existing deno tests stay green**

Run: `cd supabase/functions && deno check sync-pdf/index.ts && deno test --allow-read`
Expected: `deno check` clean; all deno tests pass (sync-google, generate-mnemonic, sync-pdf).

- [ ] **Step 9: Manual end-to-end smoke (local stack)**

Requires the local Supabase stack running and migration 0009 applied (Task 2).

1. Sign in on the app, then in SQL note your user id: `select id from auth.users;`
2. Create a source row: `insert into sources (user_id, type, external_ref, label, language) values ('<uid>', 'pdf_upload', 'hello.pdf', 'PDF smoke', 'en') returning id;`
3. Copy the fixture into Storage at `<uid>/<source-id>.pdf` (Studio → Storage → source-files, or `supabase storage cp`).
4. Invoke: `supabase functions invoke sync-pdf --body '{"sourceId":"<source-id>"}'` (with the user's JWT) — expect `results` = `diffed:2`.
5. Invoke again — expect `unchanged`.
6. Confirm `select status, content_hash is not null from sources where id='<source-id>';` is `active | t` and `select count(*) from llm_jobs where payload->>'source_id'='<source-id>';` is 1.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/sync-pdf supabase/functions/deno.json supabase/functions/deno.lock
git commit -m "feat(edge): sync-pdf function with server-side pdf.js text extraction"
```

---

### Task 5: Three-mode SourceForm

**Files:**
- Modify: `apps/web/src/components/SourceForm.tsx` (full rewrite)
- Test: `apps/web/src/components/SourceForm.test.tsx` (create)

**Interfaces:**
- Consumes: `detectSourceType` (Task 1); `api.addSource`, `api.uploadSourcePdf` (Task 3) via the mocked `@/lib/supabase` module.
- Produces: `SourceForm({ onAdded }: { onAdded: (source: Source) => void })` — **signature change**: `onAdded` now receives the created `Source` so the page (Task 6) can auto-sync PDF sources. Mode is internal state: `"google" | "pdf" | "canva"`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/SourceForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const addSource = vi.fn();
const uploadSourcePdf = vi.fn();
vi.mock("@/lib/supabase", () => ({
  api: { addSource: (...a: unknown[]) => addSource(...a), uploadSourcePdf: (...a: unknown[]) => uploadSourcePdf(...a) },
  supabase: { functions: { invoke: vi.fn() } },
}));

import { SourceForm } from "./SourceForm";

const sheetUrl = "https://docs.google.com/spreadsheets/d/1NvH/edit";
const canvaUrl = "https://www.canva.com/design/DAF123abc/view";
const pdfFile = () => new File(["%PDF-1.4"], "lesson.pdf", { type: "application/pdf" });

beforeEach(() => {
  addSource.mockReset();
  uploadSourcePdf.mockReset();
  addSource.mockResolvedValue({ id: "s1", type: "pdf_upload" });
});

describe("SourceForm", () => {
  it("google mode: submits a detected sheet link", async () => {
    const onAdded = vi.fn();
    render(<SourceForm onAdded={onAdded} />);
    fireEvent.change(screen.getByPlaceholderText(/google doc or sheet link/i), { target: { value: sheetUrl } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "google_sheet", externalRef: sheetUrl }),
    ));
    expect(uploadSourcePdf).not.toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalled();
  });

  it("google mode: rejects non-google links", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/google doc or sheet link/i), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/not a google doc or sheet link/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("pdf mode: requires a file", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /pdf upload/i }));
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/choose a pdf/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("pdf mode: adds the source then uploads the file", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /pdf upload/i }));
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pdf_upload", externalRef: "lesson.pdf" }),
    ));
    expect(uploadSourcePdf).toHaveBeenCalledWith("s1", expect.any(File));
  });

  it("canva mode: requires both link and file, stores link as externalRef", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /canva/i }));
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/canva link/i)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/canva\.com\/design/i), { target: { value: canvaUrl } });
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pdf_upload", externalRef: canvaUrl }),
    ));
    expect(uploadSourcePdf).toHaveBeenCalledWith("s1", expect.any(File));
  });

  it("canva mode: rejects non-canva links", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /canva/i }));
    fireEvent.change(screen.getByPlaceholderText(/canva\.com\/design/i), { target: { value: sheetUrl } });
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/not a canva design link/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/web test SourceForm`
Expected: FAIL — mode buttons not found (`Unable to find role "button" name /pdf upload/i`)

- [ ] **Step 3: Rewrite `SourceForm.tsx`**

Replace the whole of `apps/web/src/components/SourceForm.tsx`:

```tsx
import { useRef, useState } from "react";
import type { Source } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { detectSourceType } from "@/lib/detectSource";

const LANGS = [
  ["zh", "Chinese"], ["th", "Thai"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["ja", "Japanese"], ["ko", "Korean"], ["en", "English"],
] as const;

type Mode = "google" | "pdf" | "canva";
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB upload guard

export function SourceForm({ onAdded }: { onAdded: (source: Source) => void }) {
  const [mode, setMode] = useState<Mode>("google");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState<string>("zh");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const detected = mode === "google" ? detectSourceType(url) : null;
  const needsFile = mode !== "google";

  async function submit() {
    setError(null);
    if (mode === "google" && (!detected || detected === "canva")) {
      setError("That's not a Google Doc or Sheet link. The goose is unimpressed."); return;
    }
    if (mode === "canva" && detectSourceType(url) !== "canva") {
      setError("That's not a Canva design link. It should look like canva.com/design/…"); return;
    }
    if (needsFile && !file) { setError("Choose a PDF file first."); return; }
    if (file && file.size > MAX_PDF_BYTES) { setError("That PDF is over 10 MB — export a smaller one."); return; }

    setBusy(true);
    try {
      const externalRef = mode === "canva" ? url : mode === "pdf" ? file!.name : url;
      const type = mode === "google" ? detected! : "pdf_upload";
      const source = await api.addSource({ type, externalRef, label: label || "Untitled source", language });
      if (needsFile) await api.uploadSourcePdf(source.id, file!);
      setUrl(""); setFile(null); setLabel(""); setError(null);
      if (fileInput.current) fileInput.current.value = "";
      onAdded(source);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const tabCls = (m: Mode) =>
    `rounded-xl px-3 py-2 text-sm font-bold transition ${mode === m ? "bg-ink text-cream" : "bg-cream text-ink/60 hover:text-ink"}`;

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-3">
      <div className="flex gap-2">
        <button type="button" className={tabCls("google")} onClick={() => setMode("google")}>Google link</button>
        <button type="button" className={tabCls("pdf")} onClick={() => setMode("pdf")}>PDF upload</button>
        <button type="button" className={tabCls("canva")} onClick={() => setMode("canva")}>Canva + PDF</button>
      </div>

      {mode === "google" && (
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a Google Doc or Sheet link"
          className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
      )}
      {mode === "canva" && (
        <>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste the Canva link (canva.com/design/…)"
            className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
          <p className="text-sm text-ink/60">In Canva: Share → Download → PDF Standard, then drop the file here.</p>
        </>
      )}
      {needsFile && (
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" aria-label="PDF file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-dashed border-ink/30 bg-cream px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-1 file:text-cream" />
      )}
      {mode === "google" && detected && (
        <p className="text-sm">Detected: {detected === "google_sheet" ? "📊 Sheet" : "📄 Doc"}</p>
      )}

      <div className="flex gap-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Preply — Kru May)"
          className="flex-1 rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="rounded-xl border border-ink/20 bg-cream px-3 py-3">
          {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-beak">{error}</p>}
      <button onClick={() => void submit()} disabled={busy}
        className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-cream hover:bg-beak transition disabled:opacity-50">
        {busy ? "Connecting…" : "Connect source"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @schwanki/web test SourceForm`
Expected: PASS — all 6 SourceForm tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/SourceForm.tsx apps/web/src/components/SourceForm.test.tsx
git commit -m "feat(web): three-mode SourceForm (Google link / PDF / Canva + PDF)"
```

---

### Task 6: Sources page — Update PDF, inline edit, removal dialog

**Files:**
- Modify: `apps/web/src/pages/Sources.tsx` (full rewrite)
- Test: `apps/web/src/pages/Sources.test.tsx` (create)

**Interfaces:**
- Consumes: `SourceForm` with the new `onAdded(source)` signature (Task 5); `api.listSources`, `api.updateSource`, `api.removeSource`, `api.uploadSourcePdf` (Task 3); `isCanvaRef` (Task 1); `supabase.functions.invoke` for `sync-google` / `sync-pdf`.
- Produces: the finished Sources page. No new exports.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Sources.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Source } from "@schwanki/core";

const listSources = vi.fn();
const updateSource = vi.fn();
const removeSource = vi.fn();
const uploadSourcePdf = vi.fn();
const invoke = vi.fn();
vi.mock("@/lib/supabase", () => ({
  api: {
    listSources: () => listSources(),
    updateSource: (...a: unknown[]) => updateSource(...a),
    removeSource: (...a: unknown[]) => removeSource(...a),
    uploadSourcePdf: (...a: unknown[]) => uploadSourcePdf(...a),
    addSource: vi.fn(),
  },
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import Sources from "./Sources";

const sheet: Source = {
  id: "s1", userId: "u1", type: "google_sheet",
  externalRef: "https://docs.google.com/spreadsheets/d/1NvH",
  label: "Dogfood", language: "zh", status: "active",
};
const canvaPdf: Source = {
  id: "s2", userId: "u1", type: "pdf_upload",
  externalRef: "https://www.canva.com/design/DAF123abc/view",
  label: "Marina", language: "ja", status: "active",
};

function renderPage() {
  return render(<MemoryRouter><Sources /></MemoryRouter>);
}

beforeEach(() => {
  for (const fn of [listSources, updateSource, removeSource, uploadSourcePdf, invoke]) fn.mockReset();
  listSources.mockResolvedValue([sheet, canvaPdf]);
  invoke.mockResolvedValue({ data: { results: {} }, error: null });
});

describe("Sources page", () => {
  it("google rows offer Sync now; pdf rows offer Update PDF", async () => {
    renderPage();
    expect(await screen.findByText("Dogfood")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /sync now/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /update pdf/i })).toBeTruthy();
  });

  it("canva-backed rows link to the design", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /canva\.com\/design/i });
    expect(link.getAttribute("href")).toBe(canvaPdf.externalRef);
  });

  it("Sync now on a pdf source invokes sync-pdf", async () => {
    listSources.mockResolvedValue([canvaPdf]);
    renderPage();
    // pdf rows sync via the Update PDF flow, but an already-uploaded pdf can also be re-synced:
    fireEvent.click(await screen.findByRole("button", { name: /sync now/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("sync-pdf", { body: { sourceId: "s2" } }));
  });

  it("edit saves label and language", async () => {
    renderPage();
    const editButtons = await screen.findAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);
    fireEvent.change(screen.getByDisplayValue("Dogfood"), { target: { value: "Dogfood v2" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateSource).toHaveBeenCalledWith("s1", { label: "Dogfood v2", language: "zh" }));
  });

  it("remove dialog defaults to keep and calls removeSource with the chosen mode", async () => {
    renderPage();
    const removeButtons = await screen.findAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[0]);
    fireEvent.click(screen.getByRole("radio", { name: /remove its inbox candidates too/i }));
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(removeSource).toHaveBeenCalledWith("s1", "drop_pending"));
  });

  it("Update PDF uploads the file then syncs", async () => {
    listSources.mockResolvedValue([canvaPdf]);
    renderPage();
    const file = new File(["%PDF-1.4"], "v2.pdf", { type: "application/pdf" });
    fireEvent.change(await screen.findByLabelText(/update pdf file/i), { target: { files: [file] } });
    await waitFor(() => expect(uploadSourcePdf).toHaveBeenCalledWith("s2", file));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("sync-pdf", { body: { sourceId: "s2" } }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @schwanki/web test Sources`
Expected: FAIL — no edit/remove/Update PDF buttons on the current page

- [ ] **Step 3: Rewrite `Sources.tsx`**

Replace the whole of `apps/web/src/pages/Sources.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Source } from "@schwanki/core";
import { api, supabase } from "@/lib/supabase";
import { SourceForm } from "@/components/SourceForm";
import { isCanvaRef } from "@/lib/detectSource";

type RemoveMode = "keep" | "drop_pending" | "drop_all";
const LANGS = [
  ["zh", "Chinese"], ["th", "Thai"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["ja", "Japanese"], ["ko", "Korean"], ["en", "English"],
] as const;

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editLang, setEditLang] = useState("zh");
  const [removing, setRemoving] = useState<Source | null>(null);
  const [removeMode, setRemoveMode] = useState<RemoveMode>("keep");
  const navigate = useNavigate();
  const updateInput = useRef<HTMLInputElement>(null);
  const [updateTarget, setUpdateTarget] = useState<string | null>(null);

  const load = useCallback(async () => setSources(await api.listSources()), []);
  useEffect(() => { void load(); }, [load]);

  const fnFor = (s: Source) => (s.type === "pdf_upload" ? "sync-pdf" : "sync-google");

  async function syncNow(source: Source) {
    setSyncing(source.id);
    setSyncError(null);
    try {
      // functions.invoke attaches the session token itself — no manual header
      const { data, error } = await supabase.functions.invoke(fnFor(source), { body: { sourceId: source.id } });
      const result: string | undefined = (data as { results?: Record<string, string> } | null)?.results?.[source.id];
      if (error) throw new Error(error.message);
      if (result?.startsWith("failed:")) throw new Error(result.slice(7));
      await load();
      // Success — the new words ARE the feedback. Off to triage.
      navigate("/inbox");
    } catch (e) {
      await load(); // refresh the row's own status line
      setSyncError(`Sync failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSyncing(null);
    }
  }

  async function onAdded(source: Source) {
    await load();
    if (source.type === "pdf_upload") await syncNow(source); // first parse right away
  }

  async function saveEdit(id: string) {
    await api.updateSource(id, { label: editLabel, language: editLang });
    setEditing(null);
    await load();
  }

  async function confirmRemove() {
    if (!removing) return;
    await api.removeSource(removing.id, removeMode);
    setRemoving(null);
    setRemoveMode("keep");
    await load();
  }

  async function onUpdateFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const source = sources.find((s) => s.id === updateTarget);
    e.target.value = "";
    setUpdateTarget(null);
    if (!file || !source) return;
    setSyncError(null);
    try {
      await api.uploadSourcePdf(source.id, file);
      await syncNow(source);
    } catch (err) {
      setSyncError(`Update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-3xl font-black">Sources</h1>
      <SourceForm onAdded={(s) => void onAdded(s)} />
      {syncError && <p role="alert" className="text-sm font-bold text-beak">{syncError}</p>}

      <input ref={updateInput} type="file" accept="application/pdf,.pdf" aria-label="Update PDF file"
        className="hidden" onChange={(e) => void onUpdateFile(e)} />

      <ul className="space-y-3">
        {sources.map((s) => (
          <li key={s.id} className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-2">
            {editing === s.id ? (
              <div className="flex gap-3">
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} aria-label="Label"
                  className="flex-1 rounded-xl border border-ink/20 bg-cream px-3 py-2 outline-none focus:border-beak" />
                <select value={editLang} onChange={(e) => setEditLang(e.target.value)} aria-label="Language"
                  className="rounded-xl border border-ink/20 bg-cream px-2 py-2">
                  {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
                <button onClick={() => void saveEdit(s.id)}
                  className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-cream">Save</button>
                <button onClick={() => setEditing(null)}
                  className="rounded-xl bg-cream px-3 py-2 text-sm font-bold">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{s.label} <span className="text-sm font-normal">({s.language})</span></p>
                  {s.type === "pdf_upload" && isCanvaRef(s.externalRef) && (
                    <p className="text-sm">
                      🎨 <a href={s.externalRef} target="_blank" rel="noreferrer" className="underline text-ink/70">
                        {s.externalRef.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                  )}
                  <p className="text-sm text-ink/60">
                    {s.status === "active" && (s.lastSyncedAt ? `Synced ${new Date(s.lastSyncedAt).toLocaleString()}` : "Never synced")}
                    {s.status === "error" && `Sync failed: ${s.errorDetail ?? "unknown"} — try again`}
                    {s.status === "revoked" && "Permission revoked — reconnect Google on the sign-in screen"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {s.type === "pdf_upload" && (
                    <button onClick={() => { setUpdateTarget(s.id); updateInput.current?.click(); }}
                      className="rounded-xl bg-cream px-3 py-2 text-sm font-bold border border-ink/20">
                      Update PDF
                    </button>
                  )}
                  <button onClick={() => void syncNow(s)} disabled={syncing === s.id}
                    className="rounded-xl bg-beak px-4 py-2 font-bold text-cream disabled:opacity-50">
                    {syncing === s.id ? "Syncing…" : "Sync now"}
                  </button>
                  <button aria-label={`Edit ${s.label}`}
                    onClick={() => { setEditing(s.id); setEditLabel(s.label); setEditLang(s.language); }}
                    className="rounded-xl bg-cream px-3 py-2 text-sm font-bold border border-ink/20">Edit</button>
                  <button aria-label={`Remove ${s.label}`}
                    onClick={() => { setRemoving(s); setRemoveMode("keep"); }}
                    className="rounded-xl bg-cream px-3 py-2 text-sm font-bold border border-beak/40 text-beak">Remove</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {removing && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-6"
          role="dialog" aria-modal="true" aria-label={`Remove ${removing.label}`}>
          <div className="w-full max-w-md rounded-2xl bg-cream p-6 space-y-4">
            <h2 className="text-xl font-black">Remove “{removing.label}”?</h2>
            <div className="space-y-2 text-sm">
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={removeMode === "keep"}
                  onChange={() => setRemoveMode("keep")} />
                <span><strong>Keep everything it produced</strong> — accepted cards and Inbox candidates stay</span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={removeMode === "drop_pending"}
                  onChange={() => setRemoveMode("drop_pending")} />
                <span><strong>Remove its Inbox candidates too</strong> — accepted cards stay</span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={removeMode === "drop_all"}
                  onChange={() => setRemoveMode("drop_all")} />
                <span><strong>Remove everything</strong> — accepted cards, candidates, the lot</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRemoving(null)}
                className="rounded-xl bg-white/70 px-4 py-2 font-bold border border-ink/20">Cancel</button>
              <button onClick={() => void confirmRemove()}
                className="rounded-xl bg-beak px-4 py-2 font-bold text-cream">Remove</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @schwanki/web test Sources`
Expected: PASS — all 6 Sources page tests green. Note: the "Sync now on a pdf source invokes sync-pdf" test relies on every row having a "Sync now" button (re-syncs the stored file); if a row's button set was misread, check the failing test name first.

- [ ] **Step 5: Typecheck and full web suite**

Run: `pnpm --filter @schwanki/web typecheck && pnpm --filter @schwanki/web test`
Expected: typecheck clean; whole web suite green

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Sources.tsx apps/web/src/pages/Sources.test.tsx
git commit -m "feat(web): Sources page edit, remove-with-choice, Update PDF, Canva links"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full workspace tests + typecheck**

Run: `pnpm -r --if-present test && pnpm -r --if-present typecheck`
Expected: all packages green (core, parsing, mnemonic, web)

- [ ] **Step 2: Edge function tests**

Run: `cd supabase/functions && deno test --allow-read`
Expected: all green (sync-google, sync-pdf, generate-mnemonic)

- [ ] **Step 3: Vendor consistency**

Run: `./scripts/check-vendor.sh`
Expected: passes silently (Task 3 already re-vendored)

- [ ] **Step 4: Lint**

Run: `pnpm --filter @schwanki/web lint`
Expected: no new findings

- [ ] **Step 5: Manual smoke of the full loop (local stack)**

1. Sources tab → **PDF upload** mode → choose a real PDF → Connect. Expect: redirect to Inbox; candidates appear after parse-worker drains (up to ~10 min locally, or invoke `parse-worker` manually).
2. Sources tab → **Canva + PDF** mode → Canva link + PDF → Connect. Expect: row shows 🎨 link; same parse flow.
3. **Update PDF** on that row with a PDF containing one extra line → expect Inbox gains only the new line's candidates.
4. **Edit** a row's label → persists after reload.
5. **Remove** with each mode on throwaway sources; verify in SQL that `candidate_cards.source_id` is `null` for kept candidates and rows are gone for drop modes.

- [ ] **Step 6: Final commit (if any fixes) + summary**

```bash
git status --short  # should be clean, or commit fixes
git log --oneline -8
```

---

## Self-review notes (plan author)

- **Spec coverage:** PDF upload (Tasks 2,3,4,5,6), Canva link+export (Tasks 1,5,6), re-upload diff (Tasks 4,6), edit label+language (Tasks 3,6), three-mode removal (Tasks 2,3,6), error handling incl. image-only PDF and 10 MB guard (Tasks 4,5), testing (every task + Task 7). The spec's Inbox "Removed source" fallback is deliberately dropped — the Inbox renders no per-candidate source info (verified in `Triage.tsx`/`CandidateRow.tsx`), so there is nothing to fall back on.
- **Type consistency:** `DetectedSourceType` (Task 1) is used only inside SourceForm; `SourceForm.onAdded` signature change is reflected in Task 6's usage; `removeSource` modes `"keep" | "drop_pending" | "drop_all"` match between Task 3 implementation and Task 6 dialog.
- **Migration numbering:** existing files skip 0004; next free number is 0009 — used above.
