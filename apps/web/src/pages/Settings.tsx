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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<MediaKind, string>>(() => ({
    sentence: localStorage.getItem(PICK_KEY.sentence) ?? "",
    image: localStorage.getItem(PICK_KEY.image) ?? "",
    audio: localStorage.getItem(PICK_KEY.audio) ?? "",
  }));
  const [live, setLive] = useState<ModelCatalog | null>(null);

  const load = useCallback(async () => {
    try {
      const [providers, credits] = await Promise.all([api.listApiKeyProviders(), api.creditBalance()]);
      setSaved(Object.fromEntries(providers.map((p) => [p.provider, p.updatedAt])));
      setBalance(credits); setError(null);
    } catch (failure) { setError(`Couldn't load your settings: ${(failure as Error).message}`); }
    finally { setLoading(false); }
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
    setBusy(provider); setError(null);
    try {
      await api.saveApiKey(provider, key);
      setDraft((d) => ({ ...d, [provider]: "" }));
      setMsg("Key saved."); await load();
    } catch (failure) { setError(`Couldn't save the key: ${(failure as Error).message}`); }
    finally { setBusy(null); }
  }
  async function remove(provider: string) {
    setBusy(provider); setError(null);
    try { await api.deleteApiKey(provider); setMsg("Key deleted."); await load(); }
    catch (failure) { setError(`Couldn't delete the key: ${(failure as Error).message}`); }
    finally { setBusy(null); }
  }

  return (
    <main id="main-content" className="page-shell space-y-6">
      <header className="page-header"><h1>Settings</h1><p>Optional provider keys and model choices for card sentences, images, and audio. You can import notes and review flashcards without choosing models here.</p></header>
      {loading ? <p role="status">Loading your keys and credit balance…</p> : !error && <p className="notice">Credit balance: <strong>{balance}</strong>. When you use your own key, the provider bills you for its usage.</p>}
      {error && <div role="alert" className="error-notice"><p>{error}</p><button className="font-bold underline" onClick={() => { setLoading(true); void load(); }}>Reload settings</button></div>}
      {msg && <p role="status" className="text-sm font-bold text-beak">{msg}</p>}

      {/* One glance: which model serves which modality, and what it costs. */}
      {!loading && !error && <section className="paper-panel space-y-3">
        <h2 className="text-xl font-black">Card generation setup</h2>
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
                      {chosen}: {" "}
                      <span className={cov.covered ? "text-green-700" : "text-ink/50"}>
                        {cov.covered ? `your ${cov.via.join(" + ")} ${cov.via.length > 1 ? "keys" : "key"}` : kind === "sentence" ? "no media credit" : "1 credit per artifact"}
                      </span>
                    </>
                  ) : (
                    <>
                      Automatic model choice: {" "}
                      {cov.covered
                        ? `your ${cov.via.join(" + ")} ${cov.via.length > 1 ? "keys" : "key"}`
                        : kind === "sentence" ? "no media credit" : "1 credit per artifact"}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-sm font-bold">
          {allCovered
            ? "Your keys cover all three kinds. Provider charges still apply."
            : "Sentences use no media credits. Images and audio each cost 1 credit when a matching key is unavailable."}
        </p>
        <p className="text-xs text-ink/50">
          Choose a default model below. Select it again to restore automatic model choice. Your selection applies on this device.
        </p>
      </section>}

      {/* Provider cards: key + that provider's models, grouped by modality. */}
      <div className="source-list">
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
            <details key={provider} open={hasKey} className="border-t border-ink/20 py-4">
              <summary className="flex flex-wrap items-center gap-2 py-2">
                <span aria-hidden="true" className="provider-toggle" />
                <span className="font-bold">{info.label}</span>
                {groups.map(({ kind }) => (
                  <span key={kind} className="text-xs text-ink/70">
                    {MODALITY_LABEL[kind].replace(" (sentences)", "")}
                  </span>
                ))}
                <span className="text-xs text-ink/40">{info.blurb}</span>
                <span className="ml-auto text-sm">
                  {hasKey
                    ? <span className="font-bold text-green-700">key saved ✓</span>
                    : <span className="text-ink/40">no key</span>}
                </span>
              </summary>

              <div className="flex flex-wrap gap-2 py-3">
                <input
                  type="password"
                  aria-label={`${info.label} API key`}
                  autoComplete="off"
                  value={draft[provider] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [provider]: e.target.value }))}
                  placeholder={hasKey ? "paste new key to replace" : info.placeholder}
                  className="min-w-0 flex-1 rounded-lg border border-ink/50 bg-cream px-3 py-2 text-sm"
                />
                <button onClick={() => void save(provider)} disabled={loading || busy !== null || !(draft[provider] ?? "").trim()}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-cream disabled:opacity-50">{busy === provider ? "Saving…" : "Save"}</button>
                {hasKey && (
                  <button onClick={() => void remove(provider)} disabled={busy !== null}
                    className="rounded-lg border-2 border-ink/15 px-3 py-2 text-sm">Delete</button>
                )}
              </div>

              {groups.length > 0 && (
                <div>
                  {!hasKey && <p className="text-xs text-ink/40">Save a key to use these models</p>}
                  {hasKey && live === null && <p className="text-xs text-ink/40">loading live models…</p>}
                  {hasKey && listingFailed && (
                    <p className="text-xs text-ink/40">Couldn't reach {info.label}. Showing known models.</p>
                  )}
                  {groups.map(({ kind, models }) => (
                    <div key={kind} className="mt-2">
                      <p className="text-xs font-bold text-ink/60">{MODALITY_LABEL[kind]} models</p>
                      <ul>
                        {models.map((m) => {
                          const isDefault = picked[kind] === m.id;
                          return (
                            <li key={m.id}>
                              <button onClick={() => pickModel(kind, m.id)} disabled={!hasKey} aria-pressed={isDefault}
                                className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border-2 px-2 py-2 text-left text-sm hover:bg-white ${isDefault ? "border-beak" : "border-transparent"}`}>
                                <span className="min-w-0 break-all">
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
            </details>
          );
        })}
      </div>

      <p className="text-sm text-ink/70">Saved keys aren't displayed in the app. Delete a key or save a replacement to change it.</p>
    </main>
  );
}
