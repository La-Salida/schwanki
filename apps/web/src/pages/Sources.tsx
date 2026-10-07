import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Source } from "@schwanki/core";
import { api, supabase } from "@/lib/supabase";
import { SourceForm } from "@/components/SourceForm";
import { isCanvaRef } from "@/lib/detectSource";
import { classPdfTeacher } from "@/lib/classPdf";
import { useDialog } from "@/lib/useDialog";

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
  const [pdfTeacher, setPdfTeacher] = useState<{ label: string; language: string }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSources(await api.listSources()); setLoadError(null); }
    catch (error) { setLoadError(`Couldn't load your sources: ${(error as Error).message}`); }
    finally { setLoading(false); }
  }, []);
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
      if (!result) throw new Error("The sync returned no result for this source. Try again.");
      if (result?.startsWith("failed:")) throw new Error(result.slice(7));
      await load();
      // Success — the new words ARE the feedback. Off to triage.
      navigate("/inbox", source.type === "pdf_upload" && result?.startsWith("diffed:") && result !== "diffed:0"
        ? { state: { importingSourceId: source.id, importingLabel: source.label } }
        : undefined);
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
    try {
      await api.updateSource(id, { label: editLabel, language: editLang });
      setEditing(null); await load();
    } catch (error) { setSyncError(`Couldn't save this source: ${(error as Error).message}`); }
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
    <main id="main-content" className="page-shell space-y-6">
      <header className="page-header"><h1>Your class notes</h1><p>Connect a teacher's Google document or upload one PDF per class. New vocabulary goes to the Inbox for you to check.</p></header>
      <SourceForm onAdded={(s) => void onAdded(s)} pdfTeacher={pdfTeacher} />
      <h2 className="pt-4 text-xl font-black">Connected sources</h2>
      {loading && <p role="status">Loading your class notes…</p>}
      {loadError && <div className="error-notice" role="alert"><p>{loadError}</p><button className="underline font-bold" onClick={() => { setLoading(true); void load(); }}>Reload sources</button></div>}
      {!loading && !loadError && sources.length === 0 && <p className="notice">No class notes connected yet. Add your teacher's link or first PDF above.</p>}
      {syncError && <p role="alert" className="text-sm font-bold text-beak">{syncError}</p>}

      <input ref={updateInput} type="file" accept="application/pdf,.pdf" aria-label="Update PDF file"
        className="hidden" onChange={(e) => void onUpdateFile(e)} />

      <ul className="source-list">
        {sources.map((s) => (
          <li key={s.id} className="space-y-2">
            {editing === s.id ? (
              <div className="flex flex-wrap gap-3">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-lg font-bold">{s.label} <span className="text-sm font-normal">({LANGS.find(([code]) => code === s.language)?.[1] ?? s.language})</span></p>
                  {s.type === "pdf_upload" && isCanvaRef(s.externalRef) && (
                    <p className="text-sm">
                      <a href={s.externalRef} target="_blank" rel="noreferrer" className="break-all underline text-ink/70">
                        {s.externalRef.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                  )}
                  <p className="text-sm text-ink/60">
                    {s.status === "active" && (s.lastSyncedAt ? `Synced ${new Date(s.lastSyncedAt).toLocaleString()}` : "Never synced")}
                    {s.status === "error" && `Sync failed: ${s.errorDetail ?? "unknown"}. Try syncing again.`}
                    {s.status === "revoked" && "Google access was revoked. Reconnect your Google account."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.type === "pdf_upload" && (
                    <button onClick={() => {
                      setPdfTeacher({ label: classPdfTeacher(s.label), language: s.language });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }} className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-cream">
                      Add class PDF
                    </button>
                  )}
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
          <RemoveSourceDialog source={removing} mode={removeMode} onMode={setRemoveMode} onClose={() => setRemoving(null)} onConfirm={confirmRemove} />
        </div>
      )}
    </main>
  );
}

function RemoveSourceDialog({ source, mode, onMode, onClose, onConfirm }: {
  source: Source; mode: RemoveMode; onMode: (mode: RemoveMode) => void;
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useDialog(() => { if (!busy) onClose(); });
  async function remove() {
    setBusy(true); setError(null);
    try { await onConfirm(); }
    catch (failure) { setError(`Couldn't remove this source: ${(failure as Error).message}`); setBusy(false); }
  }
  return <div ref={ref} tabIndex={-1} className="dialog-panel space-y-4">
            <h2 className="text-xl font-black">Remove “{source.label}”?</h2>
            <div className="space-y-2 text-sm">
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={mode === "keep"} disabled={busy}
                  onChange={() => onMode("keep")} />
                <span><strong>Keep everything it produced.</strong> Accepted cards and Inbox candidates stay.</span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={mode === "drop_pending"} disabled={busy}
                  onChange={() => onMode("drop_pending")} />
                <span><strong>Remove its Inbox candidates too.</strong> Accepted cards stay.</span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={mode === "drop_all"} disabled={busy}
                  onChange={() => onMode("drop_all")} />
                <span><strong>Remove everything.</strong> Accepted cards and candidates are deleted.</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} disabled={busy} className="secondary-button">Cancel</button>
              <button onClick={() => void remove()} disabled={busy} className="primary-button">{busy ? "Removing…" : "Remove"}</button>
            </div>
            {error && <p role="alert" className="error-notice">{error}</p>}
          </div>;
}
