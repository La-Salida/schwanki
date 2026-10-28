import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { MediaKind } from "@schwanki/core";
import { AUDIO_MODELS, IMAGE_MODELS, SENTENCE_MODELS, capabilityCoverage, mergeCatalog, type KindCoverage, type ModelOption, type Provider } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { loadModelCatalog, type ModelCatalog } from "@/lib/catalog";
import { generateMnemonic } from "@/lib/mnemonic";
import { cachedCreditsStatus, loadCreditsStatus, UNKNOWN_STATUS } from "@/lib/credits";

const KINDS = ["sentence", "image", "audio"] as MediaKind[];

const MODALITY_MODELS = { sentence: SENTENCE_MODELS, image: IMAGE_MODELS, audio: AUDIO_MODELS };

const KIND_SELECTS: Array<{ kind: MediaKind; label: string; customPlaceholder: string }> = [
  { kind: "sentence", label: "Text model", customPlaceholder: "e.g. qwen/qwen3-235b-a22b" },
  { kind: "image", label: "Image model", customPlaceholder: "e.g. fal-ai/flux/dev" },
  { kind: "audio", label: "Audio model", customPlaceholder: "e.g. tts-1-hd or fal-ai/…" },
];

const KIND_BUTTONS: Array<{ kind: MediaKind; label: string; title?: string }> = [
  { kind: "sentence", label: "Memorable sentence" },
  { kind: "image", label: "Scene image", title: "adds a sentence first if needed" },
  { kind: "audio", label: "Pronunciation audio", title: "adds a sentence first if needed" },
];

// Same keys the 🪿 popover used — Settings and this section share defaults on this device.
const PICK_STORAGE: Record<MediaKind, string> = {
  sentence: "schwanki.mnemonicModel",
  image: "schwanki.mnemonicImageModel",
  audio: "schwanki.mnemonicAudioModel",
};
const CUSTOM_STORAGE: Record<MediaKind, string> = {
  sentence: "schwanki.mnemonicCustomModel",
  image: "schwanki.mnemonicCustomImageModel",
  audio: "schwanki.mnemonicCustomAudioModel",
};
const VOICE_STORAGE = "schwanki.mnemonicVoice";

const GOOSE = "The goose is painting…";

type Active = "scene" | MediaKind;

type State =
  | { phase: "idle" }
  | { phase: "generating" }
  | { phase: "done"; cost: number; failures: MediaKind[] }
  | { phase: "error"; message: string };

export function MakeItMemorable({ cardId, onGenerated, embedded = false, hasMedia = false }: { cardId: string; onGenerated?: () => void; embedded?: boolean; hasMedia?: boolean }) {
  const [hook, setHook] = useState("");
  const [picks, setPicks] = useState<Record<MediaKind, string>>({
    sentence: localStorage.getItem(PICK_STORAGE.sentence) ?? "",
    image: localStorage.getItem(PICK_STORAGE.image) ?? "",
    audio: localStorage.getItem(PICK_STORAGE.audio) ?? "",
  });
  const [customs, setCustoms] = useState<Record<MediaKind, string>>({
    sentence: localStorage.getItem(CUSTOM_STORAGE.sentence) ?? "",
    image: localStorage.getItem(CUSTOM_STORAGE.image) ?? "",
    audio: localStorage.getItem(CUSTOM_STORAGE.audio) ?? "",
  });
  const [voice, setVoice] = useState(localStorage.getItem(VOICE_STORAGE) ?? "");
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  useEffect(() => { void loadModelCatalog().then(setCatalog); }, []);

  /** Curated registry + everything the saved keys can actually serve (live catalog). */
  const optionsFor = (kind: MediaKind): ModelOption[] =>
    mergeCatalog(
      MODALITY_MODELS[kind],
      catalog ? Object.values(catalog.catalog).flatMap((pm) => pm?.[kind] ?? []) : [],
    );
  const [state, setState] = useState<State>({ phase: "idle" });
  const [active, setActive] = useState<Active>("scene");
  const [coverage, setCoverage] = useState<Record<MediaKind, KindCoverage>>(() => capabilityCoverage([]));
  const [balance, setBalance] = useState(0);
  // Kinds Schwanki AI can make with its own keys (paid with credits; sentences are free).
  const [schwanki, setSchwanki] = useState<Record<MediaKind, boolean>>(() => (cachedCreditsStatus() ?? UNKNOWN_STATUS).available);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      // The credits function is slow to wake; with a remembered status, don't wait for it.
      const credits = loadCreditsStatus().then((c) => setSchwanki(c.available), () => {
        if (!cachedCreditsStatus()) setSchwanki(UNKNOWN_STATUS.available);
      });
      const [providers, bal] = await Promise.all([api.listApiKeyProviders(), api.creditBalance()]);
      if (!cachedCreditsStatus()) await credits;
      const saved = providers.map((p) => p.provider as Provider);
      setCoverage(capabilityCoverage(saved)); setBalance(bal);
      setStatusError(null);
    } catch { setStatusError("Couldn't load generation settings. Check your connection and retry."); }
    finally { setStatusLoading(false); }
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  async function generate(kinds: MediaKind[] | undefined) {
    if (inFlight.current) return;
    inFlight.current = true;
    const models: { sentence?: string; image?: string; audio?: string } = {};
    for (const kind of KINDS) {
      const chosen = picks[kind] === "__custom__" ? customs[kind].trim() : picks[kind];
      if (chosen) models[kind] = chosen;
    }
    for (const kind of KINDS) {
      localStorage.setItem(PICK_STORAGE[kind], picks[kind]);
      localStorage.setItem(CUSTOM_STORAGE[kind], customs[kind]);
    }
    const chosenVoice = voice.trim();
    localStorage.setItem(VOICE_STORAGE, chosenVoice);
    setState({ phase: "generating" });
    try {
      const effectiveHook = hook.trim() || undefined;
      const r = await generateMnemonic(cardId, { hook: effectiveHook, models, kinds, voice: chosenVoice || undefined });
      setState({ phase: "done", cost: r.cost, failures: r.failures });
      if (typeof r.balance === "number") setBalance(r.balance);
      onGenerated?.();
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message });
    } finally {
      inFlight.current = false;
      // Coverage/paywall was computed on mount — keys or balance may have changed since
      // (a drained balance flips to paywall; keys saved earlier in the session unlock).
      void refreshStatus();
    }
  }

  const allCovered = coverage.sentence.covered && coverage.image.covered && coverage.audio.covered;
  // A kind is ready when the user's own key serves it, or Schwanki AI does and they can pay for it.
  const ready = Object.fromEntries(KINDS.map((kind) => [kind,
    coverage[kind].covered || (schwanki[kind] && (kind === "sentence" || balance >= 1))])) as Record<MediaKind, boolean>;
  const readyKinds = KINDS.filter((kind) => ready[kind]);
  const paywall = readyKinds.length === 0;
  const needsCredits = KINDS.some((kind) => kind !== "sentence" && !coverage[kind].covered && schwanki[kind] && balance < 1);
  // The full scene only asks for what can be made, so a zero balance still yields a free sentence.
  const sceneKinds = readyKinds.length === KINDS.length ? undefined : readyKinds;
  const generating = state.phase === "generating";
  const btnLabel = (key: Active, label: string) => (generating && active === key ? GOOSE : label);
  const sceneLabel = readyKinds.length === 1 && ready.sentence ? "Create free sentence" : hasMedia ? "Replace memory aids" : "Create memory aids";

  return (
    <div className={embedded ? "space-y-5 text-left" : "paper-panel space-y-5 text-left"} aria-busy={generating}>
      {!embedded && <h2 className="text-lg font-bold">Make it memorable</h2>}
      <p className="text-sm text-ink/70">Give this word a scene you can picture. Add a sentence, a helper image and audio, or create just the part you need.</p>
      {!statusLoading && !statusError && <>
      <p className="text-sm text-ink/70">
        {allCovered
          ? "Using your keys. Provider charges apply."
          : `${balance} credits available. Sentences are free; a picture and audio cost 1 credit together.`}
        {needsCredits && <>{" "}<Link to="/settings" className="font-bold underline">Buy credits</Link></>}
      </p>
      </>}
      {statusLoading ? <p role="status" className="text-sm">Loading generation settings…</p> : statusError ? <p role="alert" className="error-notice">{statusError} <button onClick={() => { setStatusLoading(true); void refreshStatus(); }} className="underline font-bold">Retry</button></p> : paywall ? (
        <>
          <p className="text-sm text-ink/70">
            Buy Schwanki AI credits or add your own provider key to make media for this card.{" "}
            <Link to="/settings" className="font-bold underline">Open Settings</Link>
          </p>
        </>
      ) : (
        <>
          <label className="block text-sm font-bold">Your idea <span className="font-normal text-ink/60">(optional)</span>
            <textarea aria-label="Your association for this word" value={hook} disabled={generating} onChange={(e) => setHook(e.target.value)} rows={3}
              placeholder="A place, person or sound — e.g. grandma’s kitchen"
              className="review-display-input mt-2" />
            <span className="mt-2 block font-normal text-ink/60">Leave it blank and Schwanki will choose a scene.</span>
          </label>
          <div>
            <button onClick={() => { setActive("scene"); void generate(sceneKinds); }} disabled={generating}
              className="primary-button w-full disabled:opacity-50">
              {btnLabel("scene", sceneLabel)}
            </button>
            {hasMedia && <p className="mt-2 text-xs text-ink/60">Replaces the generated parts on this card. Your word and meaning stay the same.</p>}
          </div>
          <details className="memory-editor-options">
            <summary>Create just one part</summary>
            <p className="my-3 text-sm text-ink/70">Image and audio use the existing sentence, or add one first if needed.</p>
            <div className="flex flex-wrap gap-2">
            {KIND_BUTTONS.map(({ kind, label, title }) => (
              <button key={kind} onClick={() => { setActive(kind); void generate([kind]); }} disabled={generating || !ready[kind]}
                title={title}
                className="secondary-button disabled:opacity-50">
                {btnLabel(kind, label)}
              </button>
            ))}
            </div>
          </details>
          <details className="memory-editor-options">
            <summary>Advanced options</summary>
            {KIND_SELECTS.map(({ kind, label, customPlaceholder }) => (
              <div key={kind}>
                <p className="mt-2 text-xs font-bold text-ink/60">{label}</p>
                <select aria-label={label} value={picks[kind]} onChange={(e) => setPicks((p) => ({ ...p, [kind]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm">
                  <option value="">Default (smart pick)</option>
                  {optionsFor(kind).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                  <option value="__custom__">Custom…</option>
                </select>
                {picks[kind] === "__custom__" && (
                  <input aria-label={`Custom ${label.toLowerCase()}`} value={customs[kind]} onChange={(e) => setCustoms((c) => ({ ...c, [kind]: e.target.value }))}
                    placeholder={customPlaceholder}
                    className="mt-1 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm" />
                )}
              </div>
            ))}
            <p className="mt-2 text-xs font-bold text-ink/60">Voice</p>
            <input aria-label="Voice ID" value={voice} onChange={(e) => setVoice(e.target.value)}
              placeholder="ElevenLabs voice ID or Fish reference ID"
              className="mt-1 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm" />
          </details>
        </>
      )}
      {state.phase === "done" && (
        <p role="status" className="text-sm font-bold text-green-700">
          Saved on this word. Return to review to see it.{state.cost > 0 && ` (${state.cost} credit${state.cost > 1 ? "s" : ""} used)`}
          {state.failures.length > 0 && ` (${state.failures.join(", ")} failed. Generate again to retry.)`}
        </p>
      )}
      {state.phase === "error" && <p role="alert" className="text-sm font-bold text-margin">{state.message}</p>}
    </div>
  );
}
