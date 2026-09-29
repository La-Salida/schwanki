import { useCallback, useEffect, useState } from "react";
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  SENTENCE_MODELS,
  allKindsCovered,
  capabilityCoverage,
  type Provider,
} from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (sentences)", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI (sentences, images, audio)", placeholder: "sk-..." },
  { id: "openrouter", label: "OpenRouter (sentences — DeepSeek, GLM, …)", placeholder: "sk-or-..." },
  { id: "fal", label: "fal (images, audio)", placeholder: "fal key..." },
  { id: "together", label: "Together (images)", placeholder: "together key..." },
  { id: "higgsfield", label: "Higgsfield (images)", placeholder: "higgsfield key..." },
] as const;

const KIND_ROWS = [
  { kind: "sentence", label: "Text (sentences)", uncovered: "add an Anthropic, OpenAI, or OpenRouter key" },
  { kind: "image", label: "Image", uncovered: "add a fal, Together, or OpenAI key" },
  { kind: "audio", label: "Audio", uncovered: "add an OpenAI or fal key" },
] as const;

const MODEL_REGISTRIES = [
  { kind: "sentence", label: "Text (sentences)", models: SENTENCE_MODELS },
  { kind: "image", label: "Image", models: IMAGE_MODELS },
  { kind: "audio", label: "Audio", models: AUDIO_MODELS },
] as const;

// Same keys the 🪿 popover reads — picking here sets the default everywhere on this device.
const PICK_KEY = {
  sentence: "schwanki.mnemonicModel",
  image: "schwanki.mnemonicImageModel",
  audio: "schwanki.mnemonicAudioModel",
} as const;

type PickKind = keyof typeof PICK_KEY;

export default function Settings() {
  const [saved, setSaved] = useState<Record<string, string>>({}); // provider → updatedAt
  const [balance, setBalance] = useState<number>(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<PickKind, string>>(() => ({
    sentence: localStorage.getItem(PICK_KEY.sentence) ?? "",
    image: localStorage.getItem(PICK_KEY.image) ?? "",
    audio: localStorage.getItem(PICK_KEY.audio) ?? "",
  }));

  function pickModel(kind: PickKind, id: string) {
    const next = picked[kind] === id ? "" : id; // tap the picked model again to return to Default
    localStorage.setItem(PICK_KEY[kind], next);
    setPicked((p) => ({ ...p, [kind]: next }));
  }

  const load = useCallback(async () => {
    const providers = await api.listApiKeyProviders();
    setSaved(Object.fromEntries(providers.map((p) => [p.provider, p.updatedAt])));
    setBalance(await api.creditBalance());
  }, []);
  useEffect(() => { void load(); }, [load]);

  const savedProviders = Object.keys(saved) as Provider[];
  const savedProviderSet = new Set(savedProviders);
  const coverage = capabilityCoverage(savedProviders);
  const allCovered = allKindsCovered(savedProviders);

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
      <section className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-3">
        <h2 className="font-bold">What your keys unlock</h2>
        <ul className="space-y-2 text-sm">
          {KIND_ROWS.map(({ kind, label, uncovered }) => {
            const cov = coverage[kind];
            return (
              <li key={kind} className="flex items-start gap-2">
                <span className={cov.covered ? "font-bold text-green-700" : "font-bold text-beak"}>
                  {cov.covered ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-bold">{label}</span>{" "}
                  {cov.covered
                    ? `free via your ${cov.via.join(" + ")} ${cov.via.length > 1 ? "keys" : "key"}`
                    : uncovered}
                </span>
              </li>
            );
          })}
          <li className="flex items-start gap-2">
            <span className="font-bold text-beak">✗</span>
            <span><span className="font-bold">Video</span> premium — coming in v2</span>
          </li>
        </ul>
        <p className="text-sm font-bold">
          {allCovered
            ? "All three covered — your generations are free forever."
            : "Missing kinds cost credits — sentences are free, each media artifact is 1 credit."}
        </p>
      </section>
      <section className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-3">
        <h2 className="font-bold">Models you can pick</h2>
        <p className="text-xs text-ink/50">Tap a model to make it your default — the review card's Model choices start from it. Tap again to go back to Default.</p>
        {MODEL_REGISTRIES.map(({ kind, label, models }) => (
          <div key={kind} className="space-y-1">
            <p className="text-sm font-bold">{label}</p>
            <ul>
              {models.map((m) => (
                <li key={m.id}>
                  <button onClick={() => pickModel(kind, m.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border-2 px-2 py-1 text-left text-sm hover:bg-cream ${picked[kind] === m.id ? "border-beak" : "border-transparent"}`}>
                    <span>
                      {m.label} <span className="text-xs text-ink/40">{m.id}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {picked[kind] === m.id && <span className="text-xs font-bold text-beak">picked ✓</span>}
                      <span className={savedProviderSet.has(m.provider) ? "text-xs font-bold text-green-700" : "text-xs text-ink/50"}>
                        {savedProviderSet.has(m.provider) ? "free" : "1 credit"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
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
