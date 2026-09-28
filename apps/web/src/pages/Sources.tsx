import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Source } from "@schwanki/core";
import { api, supabase } from "@/lib/supabase";
import { SourceForm } from "@/components/SourceForm";

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const navigate = useNavigate();
  const load = useCallback(async () => setSources(await api.listSources()), []);
  useEffect(() => { void load(); }, [load]);

  async function syncNow(id: string) {
    setSyncing(id);
    setSyncError(null);
    try {
      // functions.invoke attaches the session token itself — no manual header
      const { data, error } = await supabase.functions.invoke("sync-google", { body: { sourceId: id } });
      const result: string | undefined = (data as { results?: Record<string, string> } | null)?.results?.[id];
      if (error) throw new Error(error.message);
      if (result?.startsWith("failed:")) throw new Error(result.slice(7));
      await load();
      // Success — the new words ARE the feedback. Off to triage.
      navigate("/inbox");
    } catch (e) {
      await load(); // refresh the row's own status line (error / revoked)
      setSyncError(`Sync failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSyncing(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-3xl font-black">Sources</h1>
      <SourceForm onAdded={load} />
      {syncError && <p role="alert" className="text-sm font-bold text-beak">{syncError}</p>}
      <ul className="space-y-3">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
            <div>
              <p className="font-bold">{s.label} <span className="text-sm font-normal">({s.language})</span></p>
              <p className="text-sm text-ink/60">
                {s.status === "active" && (s.lastSyncedAt ? `Synced ${new Date(s.lastSyncedAt).toLocaleString()}` : "Never synced")}
                {s.status === "error" && `Sheet sync failed: ${s.errorDetail ?? "unknown"} — try again`}
                {s.status === "revoked" && "Permission revoked — reconnect Google on the sign-in screen"}
              </p>
            </div>
            <button onClick={() => void syncNow(s.id)} disabled={syncing === s.id}
              className="rounded-xl bg-beak px-4 py-2 font-bold text-cream disabled:opacity-50">
              {syncing === s.id ? "Syncing…" : "Sync now"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
