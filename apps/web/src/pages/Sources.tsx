import { useCallback, useEffect, useState } from "react";
import type { Source } from "@schwanki/core";
import { api, supabase } from "@/lib/supabase";
import { SourceForm } from "@/components/SourceForm";

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const load = useCallback(async () => setSources(await api.listSources()), []);
  useEffect(() => { void load(); }, [load]);

  async function syncNow(id: string) {
    setSyncing(id);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("sync-google", {
      body: { sourceId: id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    await load();
    setSyncing(null);
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-3xl font-black">Sources</h1>
      <SourceForm onAdded={load} />
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
