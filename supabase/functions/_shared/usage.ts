/** AI work that runs on Schwanki's own keys. Cheap calls get a free daily allowance per
 *  user; past it, and for the pricier calls from the first use, each one costs credits. */
export type Feature = "sentence" | "import" | "readings" | "picture" | "suggest";

export const METERED: Record<Feature, { freePerDay: number; cost: number; label: string }> = {
  sentence: { freePerDay: 50, cost: 1, label: "example sentence" },
  import: { freePerDay: 10, cost: 1, label: "note import" },
  readings: { freePerDay: 20, cost: 1, label: "pronunciations" },
  picture: { freePerDay: 0, cost: 1, label: "class picture" },
  suggest: { freePerDay: 0, cost: 1, label: "AI suggestion" },
};

const DAY_MS = 24 * 3600_000;

export const NO_CREDITS_MESSAGE = "You're out of credits. Buy credits in Billing to keep using AI here.";

export interface Allowance {
  ok: boolean;
  /** Credits this use will cost: 0 inside the free allowance or when already counted. */
  cost: number;
  balance: number;
  /** Writes the ledger row. Call it only after the AI call succeeded. */
  record: () => Promise<void>;
}

// deno-lint-ignore no-explicit-any
type Ledger = { from: (table: "credit_ledger") => any };
type LedgerRow = { usage_key: string | null; delta: number };

/** Decides whether a user may make one more metered call. `usageKey` makes repeat calls for
 *  the same thing within a day count once, such as several chunks of one imported document. */
export async function allowance(admin: Ledger, userId: string, feature: Feature, usageKey?: string): Promise<Allowance> {
  const rule = METERED[feature];
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const recent = admin.from("credit_ledger").select("usage_key, delta")
    .eq("user_id", userId).eq("feature", feature).gt("created_at", since);
  const [{ data: used, error: usedError }, { data: ledger, error: ledgerError }] = await Promise.all([
    recent, admin.from("credit_ledger").select("delta").eq("user_id", userId),
  ]);
  if (usedError) throw usedError;
  if (ledgerError) throw ledgerError;
  const balance = ((ledger ?? []) as LedgerRow[]).reduce((n, r) => n + r.delta, 0);
  const rows = (used ?? []) as LedgerRow[];
  const nothing = { ok: true, cost: 0, balance, record: async () => {} };
  if (usageKey && rows.some((r) => r.usage_key === usageKey)) return nothing;

  const free = rows.filter((r) => r.delta === 0).length < rule.freePerDay;
  const cost = free ? 0 : rule.cost;
  return {
    ok: balance >= cost,
    cost,
    balance,
    record: async () => {
      const { error } = await admin.from("credit_ledger").insert({
        user_id: userId, delta: -cost, feature, usage_key: usageKey ?? null,
        reason: free ? `${rule.label} (free daily allowance)` : rule.label,
      });
      if (error) throw error;
    },
  };
}
