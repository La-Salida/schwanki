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
