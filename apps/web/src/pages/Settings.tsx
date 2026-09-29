import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/supabase";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (sentences)", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI (sentences, images, audio)", placeholder: "sk-..." },
  { id: "openrouter", label: "OpenRouter (sentences — DeepSeek, GLM, …)", placeholder: "sk-or-..." },
  { id: "fal", label: "fal (images, audio)", placeholder: "fal key..." },
  { id: "together", label: "Together (images)", placeholder: "together key..." },
  { id: "higgsfield", label: "Higgsfield (images)", placeholder: "higgsfield key..." },
] as const;

export default function Settings() {
  const [saved, setSaved] = useState<Record<string, string>>({}); // provider → updatedAt
  const [balance, setBalance] = useState<number>(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const providers = await api.listApiKeyProviders();
    setSaved(Object.fromEntries(providers.map((p) => [p.provider, p.updatedAt])));
    setBalance(await api.creditBalance());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(provider: string) {
    const key = (draft[provider] ?? "").trim();
    if (!key) return;
    await api.saveApiKey(provider, key);
    setDraft((d) => ({ ...d, [provider]: "" }));
    setMsg("Key saved. The goose guards it with its life.");
    await load();
  }
  async function remove(provider: string) {
    await api.deleteApiKey(provider);
    setMsg("Key deleted.");
    await load();
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-3xl font-black">Settings</h1>
      <p className="text-ink/70">
        Bring your own keys and mnemonic generation is free forever. No keys? Generations cost 1 credit
        (balance: <strong>{balance}</strong>).
      </p>
      {msg && <p role="status" className="text-sm font-bold text-beak">{msg}</p>}
      <ul className="space-y-3">
        {PROVIDERS.map((p) => (
          <li key={p.id} className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold">{p.label}</p>
              {saved[p.id]
                ? <span className="text-sm font-bold text-green-700">key saved ✓</span>
                : <span className="text-sm text-ink/40">no key</span>}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={draft[p.id] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                placeholder={saved[p.id] ? "paste new key to replace" : p.placeholder}
                className="flex-1 rounded-lg border-2 border-ink/10 bg-cream px-3 py-2 text-sm"
              />
              <button onClick={() => void save(p.id)}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-cream">Save</button>
              {saved[p.id] && (
                <button onClick={() => void remove(p.id)}
                  className="rounded-lg border-2 border-ink/15 px-3 py-2 text-sm">Delete</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink/50">Keys are write-only: nobody (including you, including us) can read them back. Delete and re-save to rotate.</p>
    </main>
  );
}
