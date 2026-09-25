import { useCallback, useEffect, useState } from "react";
import type { CandidateCardRow } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { groupByBatch, type Batch } from "@/lib/groupCandidates";
import { CandidateRow } from "@/components/CandidateRow";

export default function Triage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [approveAllError, setApproveAllError] = useState<string | null>(null);
  const load = useCallback(async () => setBatches(groupByBatch(await api.listPendingCandidates())), []);
  useEffect(() => { void load(); }, [load]);

  async function approve(c: CandidateCardRow, edited?: { front: string; back: string; reading?: string }) {
    const effective = edited ? { ...c, ...edited } : c;
    await api.approveCandidate(effective);
    await load();
  }
  async function discard(c: CandidateCardRow) { await api.setCandidateStatus(c.id, "discarded"); await load(); }
  async function approveAll(batch: Batch) {
    setApproveAllError(null);
    let failed = 0;
    for (const c of batch.items) {
      try {
        await api.approveCandidate(c);
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      setApproveAllError(
        `Approved ${batch.items.length - failed} of ${batch.items.length} — ${failed} failed, approve them one by one.`,
      );
    }
    await load();
  }

  if (batches.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center space-y-4 pt-24">
        <img src="/goose.png" alt="" className="mx-auto w-32" />
        <p className="text-xl font-bold">Inbox zero. The goose has nothing to judge you for. Yet.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-8">
      <h1 className="text-3xl font-black">Fresh loot</h1>
      {approveAllError && <p role="alert" className="text-sm font-bold text-beak">{approveAllError}</p>}
      {batches.map((b) => (
        <section key={b.key} className="space-y-3 rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
          <header className="flex items-center justify-between">
            <h2 className="font-bold">{b.label} · {b.items.length} words</h2>
            <button onClick={() => void approveAll(b)}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-beak">
              Approve all ({b.items.length})
            </button>
          </header>
          {b.items.map((c) => (
            <CandidateRow key={c.id} candidate={c}
              onApprove={(edited) => void approve(c, edited)}
              onDiscard={() => void discard(c)} />
          ))}
        </section>
      ))}
    </main>
  );
}
