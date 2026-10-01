import { useCallback, useEffect, useState } from "react";
import type { MediaKind } from "@schwanki/core";
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  SENTENCE_MODELS,
  allKindsCovered,
  capabilityCoverage,
  mergeCatalog,
  type ModelOption,
  type Provider,
} from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { loadModelCatalog, type ModelCatalog } from "@/lib/catalog";

const MODALITY_LABEL: Record<MediaKind, string> = {
  sentence: "Text (sentences)",
  image: "Image",
  audio: "Audio",
};
const MODALITY_MODELS: Record<MediaKind, ModelOption[]> = {
  sentence: SENTENCE_MODELS,
  image: IMAGE_MODELS,
  audio: AUDIO_MODELS,
};
const KINDS = ["sentence", "image", "audio"] as MediaKind[];

// Same keys the 🪿 section reads — defaults chosen here apply everywhere on this device.
const PICK_KEY: Record<MediaKind, string> = {
  sentence: "schwanki.mnemonicModel",
  image: "schwanki.mnemonicImageModel",
  audio: "schwanki.mnemonicAudioModel",
};

const PROVIDER_ORDER: Provider[] = [
  "anthropic",
  "openai",
  "openrouter",
  "elevenlabs",
  "fish",
  "fal",
  "together",
  "higgsfield",
];
const PROVIDER_INFO: Record<Provider, { label: string; placeholder: string; blurb: string }> = {
  anthropic: { label: "Anthropic", placeholder: "sk-ant-...", blurb: "Claude sentences" },
  openai: { label: "OpenAI", placeholder: "sk-...", blurb: "sentences, images, audio" },
  openrouter: { label: "OpenRouter", placeholder: "sk-or-...", blurb: "DeepSeek, GLM, any chat model" },
  elevenlabs: { label: "ElevenLabs", placeholder: "eleven key...", blurb: "native-voice audio" },
  fish: { label: "Fish Audio", placeholder: "fish key...", blurb: "native-voice audio" },
  fal: { label: "fal", placeholder: "fal key...", blurb: "images, audio" },
  together: { label: "Together", placeholder: "together key...", blurb: "images" },
  higgsfield: { label: "Higgsfield", placeholder: "higgsfield key...", blurb: "images" },
};

const defaultLabel = (kind: MediaKind, id: string): string | null =>
  MODALITY_MODELS[kind].find((m) => m.id === id)?.label ?? null;

export default function Settings() {
  const [saved, setSaved] = useState<Record<string, string>>({}); // provider → updatedAt
  const [balance, setBalance] = useState<number>(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<MediaKind, string>>(() => ({
    sentence: localStorage.getItem(PICK_KEY.sentence) ?? "",
    image: localStorage.getItem(PICK_KEY.image) ?? "",
    audio: localStorage.getItem(PICK_KEY.audio) ?? "",
  }));
  const [live, setLive] = useState<ModelCatalog | null>(null);

  const load = useCallback(async () => {
    const providers = await api.listApiKeyProviders();
    setSaved(Object.fromEntries(providers.map((p) => [p.provider, p.updatedAt])));
    setBalance(await api.creditBalance());
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadModelCatalog().then(setLive); }, []);

  const savedProviders = Object.keys(saved) as Provider[];
  const savedSet = new Set<string>(savedProviders);
  const coverage = capabilityCoverage(savedProviders);
  const allCovered = allKindsCovered(savedProviders);

  function pickModel(kind: MediaKind, id: string) {
    const next = picked[kind] === id ? "" : id; // tap the default again to return to Smart pick
    localStorage.setItem(PICK_KEY[kind], next);
    setPicked((p) => ({ ...p, [kind]: next }));
  }

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
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-3xl font-black">Settings</h1>
      <p className="text-ink/70">
        Bring your own keys and mnemonic generation is free forever. No keys? Generations cost 1 credit
        (balance: <strong>{balance}</strong>).
      </p>
      {msg && <p role="status" className="text-sm font-bold text-beak">{msg}</p>}

      {/* One glance: which model serves which modality, and what it costs. */}
      <section className="space-y-2 rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
        <h2 className="font-bold">Your setup</h2>
        <ul className="space-y-2 text-sm">
          {KINDS.map((kind) => {
            const cov = coverage[kind];
            const chosen = picked[kind] ? defaultLabel(kind, picked[kind]) : null;
            return (
              <li key={kind} className="flex items-start gap-2">
                <span className={cov.covered ? "font-bold text-green-700" : "font-bold text-beak"}>
                  {cov.covered ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-bold">{MODALITY_LABEL[kind]}</span>{" "}
                  {chosen ? (
                    <>
                      {chosen} —{" "}
                      <span className={cov.covered ? "text-green-700" : "text-ink/50"}>
                        {cov.covered ? `free via your ${cov.via.join(" + ")} ${cov.via.length > 1 ? "keys" : "key"}` : "1 credit"}
                      </span>
                    </>
                  ) : (
                    <>
                      Smart pick —{" "}
                      {cov.covered
                        ? `free via your ${cov.via.join(" + ")} ${cov.via.length > 1 ? "keys" : "key"}`
                        : "1 credit"}
                    </>
                  )}
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
        <p className="text-xs text-ink/50">
          Pick a default model per modality below — tap it again to go back to Smart pick. The 🪿 section
          starts from these.
        </p>
      </section>

      {/* Provider cards: key + that provider's models, grouped by modality. */}
      <div className="space-y-4">
        {PROVIDER_ORDER.map((provider) => {
          const info = PROVIDER_INFO[provider];
          const groups = KINDS
            .map((kind) => ({
              kind,
              models: mergeCatalog(
                MODALITY_MODELS[kind].filter((m) => m.provider === provider),
                live?.catalog[provider]?.[kind] ?? [],
              ),
            }))
            .filter((g) => g.models.length > 0);
          const hasKey = Boolean(saved[provider]);
          const listingFailed = Boolean(live?.failed[provider]);
          return (
            <section key={provider} className="space-y-3 rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{info.label}</p>
                {groups.map(({ kind }) => (
                  <span key={kind} className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/50">
                    {MODALITY_LABEL[kind].replace(" (sentences)", "")}
                  </span>
                ))}
                <span className="text-xs text-ink/40">{info.blurb}</span>
                <span className="ml-auto text-sm">
                  {hasKey
                    ? <span className="font-bold text-green-700">key saved ✓</span>
                    : <span className="text-ink/40">no key</span>}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={draft[provider] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [provider]: e.target.value }))}
                  placeholder={hasKey ? "paste new key to replace" : info.placeholder}
                  className="flex-1 rounded-lg border-2 border-ink/10 bg-cream px-3 py-2 text-sm"
                />
                <button onClick={() => void save(provider)}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-cream">Save</button>
                {hasKey && (
                  <button onClick={() => void remove(provider)}
                    className="rounded-lg border-2 border-ink/15 px-3 py-2 text-sm">Delete</button>
                )}
              </div>

              {groups.length > 0 && (
                <div className={hasKey ? "" : "pointer-events-none opacity-40"}>
                  {!hasKey && <p className="text-xs text-ink/40">Save a key to use these models</p>}
                  {hasKey && live === null && <p className="text-xs text-ink/40">loading live models…</p>}
                  {hasKey && listingFailed && (
                    <p className="text-xs text-ink/40">couldn't reach {info.label} — showing known models</p>
                  )}
                  {groups.map(({ kind, models }) => (
                    <div key={kind} className="mt-2">
                      <p className="text-xs font-bold text-ink/60">{MODALITY_LABEL[kind]} models</p>
                      <ul>
                        {models.map((m) => {
                          const isDefault = picked[kind] === m.id;
                          return (
                            <li key={m.id}>
                              <button onClick={() => pickModel(kind, m.id)}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg border-2 px-2 py-1 text-left text-sm hover:bg-cream ${isDefault ? "border-beak" : "border-transparent"}`}>
                                <span>
                                  {m.label} <span className="text-xs text-ink/40">{m.id}</span>
                                </span>
                                <span className="flex items-center gap-2">
                                  {isDefault && <span className="text-xs font-bold text-beak">default ✓</span>}
                                  {m.pricing ? (
                                    <span className="text-xs text-ink/50" title="provider-side cost (you pay this on your own key)">{m.pricing}</span>
                                  ) : (
                                    <span className={savedSet.has(m.provider) ? "text-xs font-bold text-green-700" : "text-xs text-ink/50"}>
                                      {savedSet.has(m.provider) ? "your key" : "1 credit"}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-sm text-ink/50">Keys are write-only: nobody (including you, including us) can read them back. Delete and re-save to rotate.</p>
    </main>
  );
}
