import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { CandidateCardRow, Source } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { groupByBatch, type Batch } from "@/lib/groupCandidates";
import { CandidateRow } from "@/components/CandidateRow";

export default function Triage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [approveAllError, setApproveAllError] = useState<string | null>(null);
  const [approvedThisSession, setApprovedThisSession] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const location = useLocation();
  const importing = location.state as { importingSourceId?: string; importingLabel?: string } | null;
  const load = useCallback(async () => {
    try {
      const [candidates, loadedSources] = await Promise.all([api.listPendingCandidates(), api.listSources()]);
      setBatches(groupByBatch(candidates)); setSources(loadedSources); setLoadError(null);
    } catch (error) {
      setLoadError(`Couldn't load the inbox: ${(error as Error).message}`);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const waitingForImport = importing?.importingSourceId && approvedThisSession === 0 &&
    !batches.some(batch => batch.sourceId === importing.importingSourceId);
  const importNotice = waitingForImport ? (
    <div role="status" className="rounded-xl border border-ink/20 bg-white/60 p-4 space-y-2">
      <p><strong>{importing.importingLabel}</strong> was uploaded. Vocabulary is being prepared.</p>
      <p className="text-sm text-ink/60">This can take a few minutes. Refresh the inbox to check for new words.</p>
      <button onClick={() => void load()} className="rounded-xl bg-ink px-4 py-2 font-bold text-cream">Refresh inbox</button>
    </div>
  ) : null;
  const errorNotice = loadError ? <p role="alert" className="text-sm text-beak">{loadError}</p> : null;

  async function approve(c: CandidateCardRow, edited?: { front: string; back: string; reading?: string }) {
    const effective = edited ? { ...c, ...edited } : c;
    await api.approveCandidate(effective);
    setApprovedThisSession((n) => n + 1);
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
    setApprovedThisSession((n) => n + batch.items.length - failed);
    if (failed > 0) {
      setApproveAllError(
        `Approved ${batch.items.length - failed} of ${batch.items.length} — ${failed} failed, approve them one by one.`,
      );
    }
    await load();
  }

  if (batches.length === 0) {
    if (approvedThisSession > 0) {
      return (
        <main className="mx-auto max-w-2xl p-6 text-center space-y-4 pt-24">
          <img src="/goose.png" alt="" className="mx-auto w-32" />
          <p className="text-xl font-bold">{approvedThisSession} words approved — they're in your deck now.</p>
          <Link to="/" className="inline-block rounded-xl bg-beak px-6 py-3 font-bold text-cream">Go review →</Link>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-2xl p-6 text-center space-y-4 pt-24">
        {errorNotice}
        {importNotice}
        <img src="/goose.png" alt="" className="mx-auto w-32" />
        {!waitingForImport && <p className="text-xl font-bold">Inbox zero. The goose has nothing to judge you for. Yet.</p>}
        <p className="text-sm text-ink/60">New words land here after a sync. <Link to="/sources" className="underline">Check your sources →</Link></p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-8">
      <h1 className="text-3xl font-black">Fresh loot</h1>
      {errorNotice}
      {importNotice}
      {approveAllError && <p role="alert" className="text-sm font-bold text-beak">{approveAllError}</p>}
      {batches.map((b) => {
        const source = sources.find(s => s.id === b.sourceId);
        const label = source?.type === "pdf_upload" ? source.label : source ? `${source.label} · ${b.label}` : b.label;
        return (
        <section key={b.key} className="space-y-3 rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
          <header className="flex items-center justify-between">
            <h2 className="font-bold">{label} · {b.items.length} {b.items.length === 1 ? "word" : "words"}</h2>
            <button onClick={() => void approveAll(b)}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-beak">
              Approve all ({b.items.length})
            </button>
          </header>
          {b.items.map((c) => (
            <CandidateRow key={c.id} candidate={c}
              onSaved={candidate => setBatches(current => groupByBatch(current.flatMap(batch => batch.items.map(item => item.id === candidate.id ? candidate : item))))}
              onApprove={(edited) => void approve(c, edited)}
              onDiscard={() => void discard(c)} />
          ))}
        </section>
        );
      })}
    </main>
  );
}
