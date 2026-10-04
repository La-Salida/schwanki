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
