import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AUDIO_MODELS, IMAGE_MODELS, SENTENCE_MODELS, allKindsCovered, capabilityCoverage, type KindCoverage, type Provider } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { generateMnemonic } from "@/lib/mnemonic";

type PickKind = "sentence" | "image" | "audio";

const KIND_SELECTS: Array<{ kind: PickKind; label: string; models: typeof SENTENCE_MODELS; customPlaceholder: string }> = [
  { kind: "sentence", label: "Text model", models: SENTENCE_MODELS, customPlaceholder: "e.g. qwen/qwen3-235b-a22b" },
  { kind: "image", label: "Image model", models: IMAGE_MODELS, customPlaceholder: "e.g. fal-ai/flux/dev" },
  { kind: "audio", label: "Audio model", models: AUDIO_MODELS, customPlaceholder: "e.g. tts-1-hd or fal-ai/…" },
];

const PICK_STORAGE: Record<PickKind, string> = {
  sentence: "schwanki.mnemonicModel",
  image: "schwanki.mnemonicImageModel",
  audio: "schwanki.mnemonicAudioModel",
};
const CUSTOM_STORAGE: Record<PickKind, string> = {
  sentence: "schwanki.mnemonicCustomModel",
  image: "schwanki.mnemonicCustomImageModel",
  audio: "schwanki.mnemonicCustomAudioModel",
};

type State =
  | { phase: "idle" }
  | { phase: "generating"; step: string }
  | { phase: "done"; billed: boolean; failures: string[] }
  | { phase: "error"; message: string }
  | { phase: "paywall" };

export function MnemonicButton({ cardId, onGenerated }: { cardId: string; onGenerated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [hook, setHook] = useState("");
  const [picks, setPicks] = useState<Record<PickKind, string>>({
    sentence: localStorage.getItem(PICK_STORAGE.sentence) ?? "",
    image: localStorage.getItem(PICK_STORAGE.image) ?? "",
    audio: localStorage.getItem(PICK_STORAGE.audio) ?? "",
  });
  const [customs, setCustoms] = useState<Record<PickKind, string>>({
    sentence: localStorage.getItem(CUSTOM_STORAGE.sentence) ?? "",
    image: localStorage.getItem(CUSTOM_STORAGE.image) ?? "",
    audio: localStorage.getItem(CUSTOM_STORAGE.audio) ?? "",
  });
  const [state, setState] = useState<State>({ phase: "idle" });
  const [coverage, setCoverage] = useState<Record<PickKind, KindCoverage>>(() => capabilityCoverage([]));
  const [balance, setBalance] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [providers, bal] = await Promise.all([api.listApiKeyProviders(), api.creditBalance()]);
      const saved = providers.map((p) => p.provider as Provider);
      setCoverage(capabilityCoverage(saved));
      setBalance(bal);
      if (!allKindsCovered(saved) && bal < 1) setState({ phase: "paywall" });
    })();
  }, [open]);

  /** hookOverride bypasses React's async state: 🎲 passes "" so the typed hook is truly ignored (models are kept). */
  async function generate(hookOverride?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    const models: { sentence?: string; image?: string; audio?: string } = {};
    for (const kind of ["sentence", "image", "audio"] as PickKind[]) {
      const chosen = picks[kind] === "__custom__" ? customs[kind].trim() : picks[kind];
      if (chosen) models[kind] = chosen;
    }
    for (const kind of ["sentence", "image", "audio"] as PickKind[]) {
      localStorage.setItem(PICK_STORAGE[kind], picks[kind]);
      localStorage.setItem(CUSTOM_STORAGE[kind], customs[kind]);
    }
    setState({ phase: "generating", step: "The goose is painting…" });
    try {
      const effectiveHook = (hookOverride ?? hook).trim() || undefined;
      const r = await generateMnemonic(cardId, effectiveHook, models);
      setState({ phase: "done", billed: r.billed, failures: r.failures });
      onGenerated?.();
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message });
    } finally {
      inFlight.current = false;
    }
  }

  const mark = (ok: boolean) => (
    <span className={ok ? "font-bold text-green-700" : "font-bold text-beak"}>{ok ? "✓" : "✗"}</span>
  );
  const allCovered = coverage.sentence.covered && coverage.image.covered && coverage.audio.covered;

  return (
    <span className="relative inline-block">
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title="Make it memorable"
        className="rounded-lg px-2 py-1 text-lg hover:scale-110">🪿</button>
      {open && (
        <div onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-40 mt-1 w-72 rounded-2xl border-2 border-ink/10 bg-cream p-4 text-left shadow-xl">
          <p className="text-sm font-bold">Make it memorable 🪿</p>
          {state.phase === "paywall" && (
            <p className="mt-2 text-sm text-ink/70">
              Add your own key (free forever) or get credits.{" "}
              <Link to="/settings" className="font-bold underline">Open Settings →</Link>
            </p>
          )}
          {state.phase !== "paywall" && (
            <>
              <p className="mt-1 text-xs text-ink/50">
                text {mark(coverage.sentence.covered)} · image {mark(coverage.image.covered)} · audio {mark(coverage.audio.covered)}
              </p>
              <p className="text-xs text-ink/50">
                {allCovered ? "using your keys — free" : `1 credit (balance: ${balance})`}
              </p>
              {KIND_SELECTS.map(({ kind, label, models, customPlaceholder }) => (
                <div key={kind}>
                  <p className="mt-2 text-xs font-bold text-ink/60">{label}</p>
                  <select value={picks[kind]} onChange={(e) => setPicks((p) => ({ ...p, [kind]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm">
                    <option value="">Default (smart pick)</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
                  {picks[kind] === "__custom__" && (
                    <input value={customs[kind]} onChange={(e) => setCustoms((c) => ({ ...c, [kind]: e.target.value }))}
                      placeholder={customPlaceholder}
                      className="mt-1 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm" />
                  )}
                </div>
              ))}
              <textarea value={hook} onChange={(e) => setHook(e.target.value)} rows={2}
                placeholder="your association… optional (grandma's kitchen, sounds like 'future')"
                className="mt-2 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm" />
              <div className="mt-2 flex gap-2">
                <button onClick={() => void generate()} disabled={state.phase === "generating"}
                  className="flex-1 rounded-lg bg-beak px-3 py-1.5 text-sm font-bold text-cream disabled:opacity-50">
                  {state.phase === "generating" ? state.step : "Generate"}
                </button>
                <button onClick={() => { setHook(""); void generate(""); }} disabled={state.phase === "generating"}
                  title="surprise me"
                  className="rounded-lg border-2 border-ink/15 px-3 py-1.5 text-sm disabled:opacity-50">🎲</button>
              </div>
            </>
          )}
          {state.phase === "done" && (
            <p className="mt-2 text-sm font-bold text-green-700">
              Done{state.billed ? " (−1 credit)" : ""} — it's on the card now.
              {state.failures.length > 0 && ` (${state.failures.join(", ")} failed — free retry on next generate)`}
            </p>
          )}
          {state.phase === "error" && <p role="alert" className="mt-2 text-sm font-bold text-beak">{state.message}</p>}
        </div>
      )}
    </span>
  );
}
