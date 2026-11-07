import { assertEquals } from "jsr:@std/assert@1";
import { allowance } from "./usage.ts";

type Row = { user_id: string; delta: number; feature?: string | null; usage_key?: string | null; created_at: string; reason?: string };
type PlusRow = { user_id: string; expires_at: string };

/** Just enough of the Supabase query builder for the ledger reads and insert in usage.ts. */
function fakeLedger(rows: Row[], plus: PlusRow[] = []) {
  const from = (table: string) => {
    const source: Array<Record<string, unknown>> = table === "plus_subscriptions" ? plus : rows;
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const q = {
      select: () => q,
      limit: () => q,
      eq: (col: string, v: unknown) => { filters.push((r) => r[col] === v); return q; },
      gt: (col: string, v: string) => { filters.push((r) => String(r[col]) > v); return q; },
      then: (resolve: (x: { data: unknown[]; error: null }) => void) => resolve({ data: source.filter((r) => filters.every((f) => f(r))), error: null }),
      insert: (row: Omit<Row, "created_at">) => { rows.push({ ...row, created_at: new Date().toISOString() }); return Promise.resolve({ error: null }); },
    };
    return q;
  };
  return { from } as unknown as Parameters<typeof allowance>[0];
}

const now = () => new Date().toISOString();
const old = new Date(Date.now() - 25 * 3600_000).toISOString();

Deno.test("cheap calls are free inside the daily allowance and logged at zero", async () => {
  const rows: Row[] = [{ user_id: "u", delta: 0, created_at: now() }];
  const a = await allowance(fakeLedger(rows), "u", "sentence");
  assertEquals([a.ok, a.cost], [true, 0]);
  await a.record();
  assertEquals(rows.at(-1)?.delta, 0);
  assertEquals(rows.at(-1)?.feature, "sentence");
});

Deno.test("past the allowance a call costs a credit, and is refused without one", async () => {
  const used = Array.from({ length: 10 }, () => ({ user_id: "u", delta: 0, feature: "import", created_at: now() }));
  const broke = await allowance(fakeLedger([...used]), "u", "import", "doc-11");
  assertEquals([broke.ok, broke.cost, broke.balance], [false, 1, 0]);
  const paid = await allowance(fakeLedger([...used, { user_id: "u", delta: 5, created_at: now() }]), "u", "import", "doc-11");
  assertEquals([paid.ok, paid.cost, paid.balance], [true, 1, 5]);
});

Deno.test("yesterday's uses don't count against today", async () => {
  const used = Array.from({ length: 10 }, () => ({ user_id: "u", delta: 0, feature: "import", created_at: old }));
  const a = await allowance(fakeLedger(used), "u", "import", "doc");
  assertEquals([a.ok, a.cost], [true, 0]);
});

Deno.test("a document already counted today is not counted again", async () => {
  const used = Array.from({ length: 10 }, (_, i) => ({ user_id: "u", delta: 0, feature: "import", usage_key: `doc-${i}`, created_at: now() }));
  const rows = [...used];
  const a = await allowance(fakeLedger(rows), "u", "import", "doc-3");
  assertEquals([a.ok, a.cost], [true, 0]);
  await a.record();
  assertEquals(rows.length, 10);
});

Deno.test("pricier calls cost a credit from the first use", async () => {
  const a = await allowance(fakeLedger([{ user_id: "u", delta: 1, created_at: now() }]), "u", "picture", "hash");
  assertEquals([a.ok, a.cost], [true, 1]);
  const rows: Row[] = [];
  const none = await allowance(fakeLedger(rows), "u", "suggest");
  assertEquals(none.ok, false);
});

Deno.test("a Plus subscriber pays nothing past the allowance, and an expired one pays again", async () => {
  const used = Array.from({ length: 10 }, () => ({ user_id: "u", delta: 0, feature: "import", created_at: now() }));
  const soon = new Date(Date.now() + 3600_000).toISOString();
  const rows = [...used];
  const plus = await allowance(fakeLedger(rows, [{ user_id: "u", expires_at: soon }]), "u", "import", "doc-11");
  assertEquals([plus.ok, plus.cost, plus.balance], [true, 0, 0]);
  await plus.record();
  assertEquals([rows.at(-1)?.delta, rows.at(-1)?.reason], [0, "note import (Plus)"]);
  const lapsed = await allowance(fakeLedger([...used], [{ user_id: "u", expires_at: old }]), "u", "import", "doc-12");
  assertEquals([lapsed.ok, lapsed.cost], [false, 1]);
  const someoneElse = await allowance(fakeLedger([...used], [{ user_id: "v", expires_at: soon }]), "u", "import", "doc-12");
  assertEquals([someoneElse.ok, someoneElse.cost], [false, 1]);
});
