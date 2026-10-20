import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { CandidateCardRow, Source } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { groupByBatch, type Batch } from "@/lib/groupCandidates";
import { CandidateRow } from "@/components/CandidateRow";
import { ImportProgress } from "@/components/ImportProgress";

const APPROVE_ALL_CONCURRENCY = 4;

export default function Triage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [approveAllError, setApproveAllError] = useState<string | null>(null);
  // Approving a large class takes a while; show progress and block repeat clicks that would race each other.
  const [approvingAll, setApprovingAll] = useState<{ key: string; done: number; total: number } | null>(null);
  const [approvedThisSession, setApprovedThisSession] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Once the imported source's words have shown up (or its parse finished), stop waiting for them.
  const [importSettled, setImportSettled] = useState<"arrived" | "empty" | "failed" | null>(null);
  const location = useLocation();
  const importing = location.state as { importingSourceId?: string; importingLabel?: string; onboardingDone?: boolean } | null;
  const load = useCallback(async () => {
    try {
      const [candidates, loadedSources] = await Promise.all([api.listPendingCandidates(), api.listSources()]);
      setBatches(groupByBatch(candidates)); setSources(loadedSources); setLoadError(null);
    } catch (error) {
      setLoadError(`Couldn't load the inbox: ${(error as Error).message}`);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const importingSource = sources.find(source => source.id === importing?.importingSourceId);
  const importFailed = importingSource?.status === "error" || importingSource?.status === "revoked";
  const importArrived = batches.some(batch => batch.sourceId === importing?.importingSourceId);
  if (importArrived && importSettled === null) setImportSettled("arrived");
  const waitingForImport = Boolean(importing?.importingSourceId && importSettled === null && !importArrived);
  const importSourceId = importing?.importingSourceId;
  useEffect(() => {
    if (!waitingForImport || importFailed || !importSourceId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await load();
      // A finished parse with no new candidates (all duplicates) or a failed one never creates a batch.
      const status = await api.parseJobStatus(importSourceId).catch(() => null);
      if (cancelled) return;
      if (status === "done" || status === "failed") {
        const candidates = await api.listPendingCandidates().catch(() => null);
        if (cancelled) return;
        if (!candidates?.some(c => c.sourceId === importSourceId)) { setImportSettled(status === "done" ? "empty" : "failed"); return; }
      }
      timer = setTimeout(() => void poll(), 5000);
    };
    timer = setTimeout(() => void poll(), 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [waitingForImport, importFailed, importSourceId, load]);
  const importLabel = importingSource?.label ?? importing?.importingLabel ?? "Your class PDF";
  const importNotice = waitingForImport ? (
    <ImportProgress label={importLabel}
      error={importFailed ? importingSource?.errorDetail ?? "Try syncing these notes again from your class notes." : null}
      compact={batches.length > 0} />
  ) : importSettled === "failed" ? (
    <ImportProgress label={importLabel} compact={batches.length > 0}
      error="The goose couldn't read vocabulary from these notes. Try syncing them again from your class notes." />
  ) : importSettled === "empty" ? (
    <p role="status" className="notice"><strong>{importLabel}</strong> had no new words. Everything in it is already in your decks or Inbox.</p>
  ) : null;
  const errorNotice = loadError ? <p role="alert" className="text-sm text-beak">{loadError}</p> : null;
  // Onboarding lands here when the uploaded PDFs yielded no vocabulary at all.
  const fromOnboarding = importing?.onboardingDone === true;

  async function approve(c: CandidateCardRow, edited?: { front: string; back: string; reading?: string }) {
    const effective = edited ? { ...c, ...edited } : c;
    try {
      await api.approveCandidate(effective);
      setApprovedThisSession((n) => n + 1);
      await load();
    } catch (error) { setLoadError(`Couldn't approve this word: ${(error as Error).message}`); }
  }
  async function discard(c: CandidateCardRow) {
    try { await api.setCandidateStatus(c.id, "discarded"); await load(); }
    catch (error) { setLoadError(`Couldn't discard this word: ${(error as Error).message}`); }
  }
  async function approveAll(batch: Batch) {
    if (approvingAll) return;
    const total = batch.items.length;
    setApproveAllError(null);
    setApprovingAll({ key: batch.key, done: 0, total });
    let done = 0;
    let failed = 0;
    const queue = [...batch.items];
    const worker = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          await api.approveCandidate(c);
        } catch {
          failed++;
        }
        done++;
        setApprovingAll({ key: batch.key, done, total });
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(APPROVE_ALL_CONCURRENCY, total) }, worker));
      setApprovedThisSession((n) => n + total - failed);
      if (failed > 0) {
        setApproveAllError(
          `Approved ${total - failed} of ${total}. ${failed} failed; try approving them one by one.`,
        );
      }
      await load();
    } finally {
      setApprovingAll(null);
    }
  }

  if (loading) return <main id="main-content" className="page-shell" role="status">Loading vocabulary from your classes…</main>;
  if (waitingForImport && batches.length === 0) {
    return <main id="main-content" className="page-shell import-shell">
      {importNotice}
      {loadError && <div className="import-progress__connection" role="alert">
        <p>{loadError}</p>
        <button className="secondary-button" onClick={() => void load()}>Check again</button>
      </div>}
    </main>;
  }
  if (batches.length === 0) {
    if (approvedThisSession > 0) {
      return (
        <main id="main-content" className="page-shell app-empty text-center space-y-4">
          <img src="/goose.png" alt="" className="mx-auto w-32" />
          <h1 className="text-3xl font-black">{approvedThisSession} words ready to review.</h1>
          <p className="text-ink/70">The goose has filed them. Your turn.</p>
          <Link to="/" className="primary-button">Review these words</Link>
        </main>
      );
    }
    return (
      <main id="main-content" className="page-shell app-empty text-center space-y-4">
        {errorNotice}
        {importNotice}
        <img src="/goose.png" alt="" className="mx-auto w-32" />
        <h1 className="text-3xl font-black">{loadError ? "The Inbox couldn't load" : fromOnboarding ? "No new words in those notes" : "Your Inbox is clear"}</h1>
        {!waitingForImport && !loadError && <p className="text-ink/70">{fromOnboarding
          ? "Your upload worked, but the goose couldn't pull vocabulary out of it. A scanned PDF without selectable text is the usual culprit — try a text-based export."
          : "New vocabulary appears here after you sync a source or upload a class PDF."}</p>}
        {loadError ? <button className="secondary-button" onClick={() => { setLoading(true); void load(); }}>Reload inbox</button> : <Link to="/sources" className="primary-button">Add or sync class notes</Link>}
      </main>
    );
  }

  return (
    <main id="main-content" className="page-shell space-y-8">
      <header className="page-header"><p className="app-eyebrow">Inbox</p><h1>Keep the words <span className="app-highlight">worth knowing.</span></h1><p>Approve the words you want to learn. Tap a word to correct it or fill a missing reading or meaning.</p></header>
      {errorNotice}
      {importNotice}
      {approveAllError && <p role="alert" className="text-sm font-bold text-beak">{approveAllError}</p>}
      {batches.map((b) => {
        const source = sources.find(s => s.id === b.sourceId);
        const label = source?.type === "pdf_upload" ? source.label : source ? `${source.label} · ${b.label}` : b.label;
        return (
        <section key={b.key} className="paper-panel space-y-3">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-bold">{label} · {b.items.length} {b.items.length === 1 ? "word" : "words"}</h2>
            <button onClick={() => void approveAll(b)} disabled={approvingAll !== null}
              aria-busy={approvingAll?.key === b.key}
              className="primary-button text-sm">
              {approvingAll?.key === b.key
                ? `Approving ${approvingAll.done} of ${approvingAll.total}…`
                : `Approve all (${b.items.length})`}
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
