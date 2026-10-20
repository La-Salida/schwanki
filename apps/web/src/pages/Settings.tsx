import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { MediaKind } from "@schwanki/core";
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  SENTENCE_MODELS,
  allKindsCovered,
  capabilityCoverage,
  formatPrice,
  mergeCatalog,
  type ModelOption,
  type Provider,
} from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { loadModelCatalog, type ModelCatalog } from "@/lib/catalog";
import { loadCreditsStatus, startCheckout, UNKNOWN_STATUS, type CreditsStatus } from "@/lib/credits";

type AiMode = "schwanki" | "keys";
const MODE_KEY = "schwanki.aiMode";

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
  "deepseek",
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
  deepseek: { label: "DeepSeek", placeholder: "sk-...", blurb: "DeepSeek sentences" },
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
  const [status, setStatus] = useState<CreditsStatus>(UNKNOWN_STATUS);
  const [mode, setMode] = useState<AiMode | null>(() => localStorage.getItem(MODE_KEY) as AiMode | null);
  const [params, setParams] = useSearchParams();
  const checkout = params.get("credits"); // "success" | "cancelled" after Stripe redirects back

  const load = useCallback(async () => {
    try {
      const [providers, credits] = await Promise.all([api.listApiKeyProviders(), api.creditBalance()]);
      setSaved(Object.fromEntries(providers.map((p) => [p.provider, p.updatedAt])));
      setBalance(credits); setError(null);
      // First visit: show the path that matches what the user already has.
      setMode((m) => m ?? (providers.length > 0 ? "keys" : "schwanki"));
    } catch (failure) { setError(`Couldn't load your settings: ${(failure as Error).message}`); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadModelCatalog().then(setLive); }, []);
  useEffect(() => { void loadCreditsStatus().then(setStatus).catch(() => setStatus(UNKNOWN_STATUS)); }, []);
  // Stripe's webhook lands moments after the redirect: refresh the balance a few times.
  useEffect(() => {
    if (checkout !== "success") return;
    const timers = [2000, 5000, 10000].map((ms) => setTimeout(() => void load(), ms));
    return () => timers.forEach(clearTimeout);
  }, [checkout, load]);

  function chooseMode(next: AiMode) {
    localStorage.setItem(MODE_KEY, next);
    setMode(next);
  }
  async function buy(packId: CreditsStatus["packs"][number]["id"]) {
    setBusy(`pack:${packId}`); setError(null);
    try { window.location.assign(await startCheckout(packId)); }
    catch (failure) { setError(`Couldn't open checkout: ${(failure as Error).message}`); setBusy(null); }
  }

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
      <header className="page-header"><p className="app-eyebrow">Make it yours</p><h1>Settings</h1><p>Add sentences, pictures, and audio when a word needs help sticking. Your decks and reviews work without AI.</p></header>
      {loading && <p role="status">Loading your keys and credit balance…</p>}
      {error && <div role="alert" className="error-notice"><p>{error}</p><button className="font-bold underline" onClick={() => { setLoading(true); void load(); }}>Reload settings</button></div>}
      {msg && <p role="status" className="text-sm font-bold text-beak">{msg}</p>}
      {checkout === "success" && (
        <p role="status" className="notice">Payment received, thank you. Your credits show up here within a few seconds.</p>
      )}
      {checkout === "cancelled" && (
        <p role="status" className="notice">
          Checkout cancelled. You weren't charged.{" "}
          <button className="font-bold underline" onClick={() => setParams({}, { replace: true })}>Dismiss</button>
        </p>
      )}

      {!loading && !error && mode && <fieldset className="space-y-3">
        <legend className="mb-3 text-xl font-black">How should Schwanki pay for AI?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["schwanki", "Schwanki AI", "Easiest. Nothing to set up. Buy credits and Schwanki runs the AI for you."],
            ["keys", "Your own keys", "Paste keys from OpenAI, Anthropic, ElevenLabs and others. They bill you directly and no credits are used."],
          ] as const).map(([value, title, blurb]) => (
            <label key={value}
              className={`block min-h-11 cursor-pointer rounded-xl border-2 p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${mode === value ? "border-beak bg-white" : "border-ink/15 bg-white/40 hover:bg-white"}`}>
              <span className="flex items-center gap-2 font-black">
                <input type="radio" name="ai-mode" value={value} checked={mode === value} onChange={() => chooseMode(value)}
                  className="h-4 w-4 accent-beak" />
                {title}
              </span>
              <span className="mt-1 block text-sm text-ink/70">{blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>}

      {!loading && !error && mode === "schwanki" && <section className="paper-panel space-y-4" aria-label="Schwanki AI credits">
        <p className="text-lg">You have <strong className="text-2xl font-black">{balance}</strong> {balance === 1 ? "credit" : "credits"}.</p>
        <ul className="space-y-1 text-sm">
          <li><span className="font-bold">Example sentences:</span> free</li>
          <li><span className="font-bold">Picture and audio for a card:</span> 1 credit together, or 1 credit for either one alone</li>
        </ul>
        {KINDS.some((k) => !status.available[k]) && status !== UNKNOWN_STATUS && (
          <p className="text-sm text-ink/70">
            Not on Schwanki AI yet: {KINDS.filter((k) => !status.available[k]).map((k) => MODALITY_LABEL[k].toLowerCase()).join(", ")}. Use your own key for these for now.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {status.packs.map((pack) => (
            <div key={pack.id} className="rounded-xl border border-ink/20 bg-cream p-4">
              <p className="font-black">{pack.label}</p>
              <p className="text-2xl font-black">{pack.credits} <span className="text-sm font-bold">credits</span></p>
              <p className="text-sm text-ink/60">{formatPrice(pack.priceCents)} · {formatPrice(Math.round(pack.priceCents / pack.credits * 100) / 100)} each</p>
              <button onClick={() => void buy(pack.id)} disabled={!status.purchasesEnabled || busy !== null}
                className="mt-3 min-h-11 w-full rounded-lg bg-ink px-4 py-2 text-sm font-bold text-cream disabled:opacity-50">
                {busy === `pack:${pack.id}` ? "Opening checkout…" : `Buy for ${formatPrice(pack.priceCents)}`}
              </button>
            </div>
          ))}
        </div>
        {!status.purchasesEnabled && <p className="text-sm text-ink/70">Buying credits isn't open yet.</p>}
        {savedProviders.length > 0 && (
          <p className="text-sm text-ink/70">
            You also have saved keys ({savedProviders.map((p) => PROVIDER_INFO[p]?.label ?? p).join(", ")}). Schwanki uses them first for what they cover, and credits pay for the rest.
          </p>
        )}
        <p className="text-xs text-ink/50">Schwanki AI uses DeepSeek for sentences, fal for pictures and ElevenLabs for audio, through Schwanki's accounts. To pick other models, add your own keys. Payments are handled by Stripe.</p>
      </section>}

      {/* One glance: which model serves which modality, and what it costs. */}
      {!loading && !error && mode === "keys" && <section className="paper-panel space-y-3">
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
            : "Kinds without a matching key fall back to Schwanki AI credits (pictures and audio cost 1 credit)."}
        </p>
        <p className="text-xs text-ink/50">
          Choose a default model below. Select it again to restore automatic model choice. Your selection applies on this device.
        </p>
      </section>}

      {/* Provider cards: key + that provider's models, grouped by modality. */}
      {mode === "keys" && <div className="source-list">
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
      </div>}

      {mode === "keys" && <p className="text-sm text-ink/70">Saved keys aren't displayed in the app. Delete a key or save a replacement to change it. Saved keys are used before credits.</p>}
    </main>
  );
}
