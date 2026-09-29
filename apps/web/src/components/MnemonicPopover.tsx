import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SENTENCE_MODELS } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { generateMnemonic } from "@/lib/mnemonic";

type State =
  | { phase: "idle" }
  | { phase: "generating"; step: string }
  | { phase: "done"; billed: boolean; failures: string[] }
  | { phase: "error"; message: string }
  | { phase: "paywall" };

export function MnemonicButton({ cardId, onGenerated }: { cardId: string; onGenerated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [hook, setHook] = useState("");
  const [model, setModel] = useState(() => localStorage.getItem("schwanki.mnemonicModel") ?? "");
  const [customModel, setCustomModel] = useState(() => localStorage.getItem("schwanki.mnemonicCustomModel") ?? "");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [balance, setBalance] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [providers, bal] = await Promise.all([api.listApiKeyProviders(), api.creditBalance()]);
      setHasKeys(providers.length > 0);
      setBalance(bal);
      if (providers.length === 0 && bal < 1) setState({ phase: "paywall" });
    })();
  }, [open]);

  /** hookOverride bypasses React's async state: 🎲 passes "" so the typed hook is truly ignored. */
  async function generate(hookOverride?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    const chosen = model === "__custom__" ? customModel.trim() : model;
    localStorage.setItem("schwanki.mnemonicModel", model);
    localStorage.setItem("schwanki.mnemonicCustomModel", customModel);
    setState({ phase: "generating", step: "The goose is painting…" });
    try {
      const effectiveHook = (hookOverride ?? hook).trim() || undefined;
      const r = await generateMnemonic(cardId, effectiveHook, chosen || undefined);
      setState({ phase: "done", billed: r.billed, failures: r.failures });
      onGenerated?.();
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message });
    } finally {
      inFlight.current = false;
    }
  }

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
                {hasKeys ? "using your keys — free" : `1 credit (balance: ${balance})`}
              </p>
              <select value={model} onChange={(e) => setModel(e.target.value)}
                className="mt-2 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm">
                <option value="">Default (smart pick)</option>
                {(["anthropic", "openai", "openrouter"] as const).map((provider) => (
                  <optgroup key={provider} label={provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "OpenRouter"}>
                    {SENTENCE_MODELS.filter((m) => m.provider === provider).map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="__custom__">Custom… (OpenRouter slug)</option>
              </select>
              {model === "__custom__" && (
                <input value={customModel} onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. qwen/qwen3-235b-a22b"
                  className="mt-2 w-full rounded-lg border-2 border-ink/10 bg-white/70 px-2 py-1 text-sm" />
              )}
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
