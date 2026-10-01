import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { MediaKind, Source } from "@schwanki/core";
import type { Provider } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { generateMnemonic } from "@/lib/mnemonic";
import { loadModelCatalog, type ModelCatalog } from "@/lib/catalog";
import { deckCards, estimateBulk, existingKindsByCard, providerCost, runsForDeck, type CardRef, type DeckScope } from "@/lib/bulk";
import { SOURCE_ICON, flagFor } from "@/lib/meta";

const KIND_LABEL: Record<MediaKind, string> = {
  sentence: "Memorable sentences",
  image: "Scene images",
  audio: "Pronunciation audio",
};

type Phase = "setup" | "running" | "done";

interface RunState {
  done: number;
  total: number;
  current: string | null;
  ok: number;
  failed: Array<{ front: string; error: string }>;
  creditsSpent: number;
}

/** Deck-wide mnemonic generation: pick a deck (teacher or language), see the exact
 *  credit cost before starting, then generate card-by-card with live progress.
 *  Stop anytime — completed cards persist, and re-running resumes (skip-existing). */
export function BulkGenerateModal({ onClose }: { onClose: () => void }) {
  const [refs, setRefs] = useState<CardRef[] | null>(null);
  const [existing, setExisting] = useState<Map<string, Set<MediaKind>> | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [savedProviders, setSavedProviders] = useState<Provider[]>([]);
  const [balance, setBalance] = useState(0);
  const [by, setBy] = useState<"source" | "language">("source");
  const [deck, setDeck] = useState<string | null>(null);
  const [kinds, setKinds] = useState<Set<MediaKind>>(new Set(["sentence", "image", "audio"]));
  const [skipExisting, setSkipExisting] = useState(true);
  const [phase, setPhase] = useState<Phase>("setup");
  const [run, setRun] = useState<RunState>({ done: 0, total: 0, current: null, ok: 0, failed: [], creditsSpent: 0 });
  const [catalog, setCatalog] = useState<ModelCatalog["catalog"]>({});
  const stop = useRef(false);

  useEffect(() => {
    void (async () => {
      const [r, m, s, p, b, cat] = await Promise.all([
        api.listCardRefs(), api.listMediaKinds(), api.listSources(),
        api.listApiKeyProviders(), api.creditBalance(), loadModelCatalog(),
      ]);
      setRefs(r);
      setExisting(existingKindsByCard(m));
      setSources(s);
      setSavedProviders(p.map((x) => x.provider as Provider));
      setBalance(b);
      setCatalog(cat.catalog);
      // A single deck (one teacher, or one language) is the obvious choice — pick it.
      const srcDecks = s.filter((src) => r.some((x) => x.sourceId === src.id));
      if (srcDecks.length === 1) setDeck(srcDecks[0]!.id);
    })();
  }, []);

  const decks = useMemo(() => {
    if (!refs) return [];
    if (by === "source") {
      return sources
        .map((s) => ({ value: s.id, label: s.label, icon: SOURCE_ICON[s.type], meta: s.language }))
        .filter((d) => refs.some((r) => r.sourceId === d.value));
    }
    const langs = new Map<string, number>();
    for (const r of refs) langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
    return [...langs.entries()]
      .map(([value, count]) => ({ value, label: value, icon: flagFor(value), meta: `${count} cards` }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }, [refs, sources, by]);

  const runs = useMemo(() => {
    if (!refs || !existing || !deck) return [];
    const scope: DeckScope = by === "source" ? { by: "source", value: deck } : { by: "language", value: deck };
    return runsForDeck(deckCards(refs, scope), existing, [...kinds], skipExisting);
  }, [refs, existing, deck, kinds, skipExisting, by]);

  const estimate = useMemo(() => estimateBulk(runs, savedProviders), [runs, savedProviders]);
  const cost = useMemo(() => providerCost(runs, [...kinds], savedProviders, catalog), [runs, kinds, savedProviders, catalog]);
  const requested = [...kinds];
  const notEnough = estimate.credits > balance;

  async function start() {
    stop.current = false;
    setPhase("running");
    setRun({ done: 0, total: runs.length, current: null, ok: 0, failed: [], creditsSpent: 0 });
    for (const r of runs) {
      if (stop.current) break;
      setRun((s) => ({ ...s, current: r.front }));
      try {
        const res = await generateMnemonic(r.cardId, { kinds: r.kinds });
        setRun((s) => ({
          ...s, done: s.done + 1, ok: s.ok + 1, creditsSpent: s.creditsSpent + res.cost,
          current: null,
          ...(typeof res.balance === "number" ? {} : {}),
        }));
        if (typeof res.balance === "number") setBalance(res.balance);
      } catch (e) {
        setRun((s) => ({
          ...s, done: s.done + 1,
          failed: [...s.failed, { front: r.front, error: (e as Error).message }],
          current: null,
        }));
      }
    }
    setRun((s) => ({ ...s, current: null }));
    setPhase("done");
  }

  const pct = run.total > 0 ? Math.round((run.done / run.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-ink/10 bg-cream p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-black">✨ Generate for a deck</p>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-ink/50 hover:bg-ink/5">close</button>
        </div>

        {refs === null || existing === null ? (
          <p className="p-4 text-center text-sm text-ink/50">Counting the deck…</p>
        ) : phase !== "setup" ? (
          <div className="space-y-3">
            <div className="h-3 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-beak transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-center text-sm font-bold">
              {run.done} / {run.total} ({pct}%){run.current ? ` · ${run.current}` : ""}
            </p>
            {phase === "running" ? (
              <>
                <p className="text-center text-xs text-ink/50">
                  Runs in this tab — keep it open. Stop anytime; finished cards are saved and re-running resumes.
                </p>
                <button onClick={() => { stop.current = true; }}
                  className="w-full rounded-xl border-2 border-ink/15 px-4 py-2 font-bold">Stop</button>
              </>
            ) : (
              <>
                <p className="text-center text-sm font-bold text-green-700">
                  Done — {run.ok} succeeded{run.failed.length > 0 ? `, ${run.failed.length} failed` : ""}.
                  {run.creditsSpent > 0 && ` (−${run.creditsSpent} credit${run.creditsSpent > 1 ? "s" : ""})`}
                </p>
                {run.failed.length > 0 && (
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border-2 border-ink/10 p-2 text-xs">
                    {run.failed.map((f, i) => (
                      <li key={i} className="text-beak">{f.front}: {f.error}</li>
                    ))}
                  </ul>
                )}
                <p className="text-center text-xs text-ink/40">Failed cards are still missing their media — run again to retry just those.</p>
                <button onClick={onClose} className="w-full rounded-xl bg-ink px-4 py-2 font-bold text-cream">Close</button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 text-sm">
              <button onClick={() => { setBy("source"); setDeck(null); }}
                className={`flex-1 rounded-xl px-3 py-1.5 font-bold ${by === "source" ? "bg-ink text-cream" : "border-2 border-ink/15"}`}>
                By teacher
              </button>
              <button onClick={() => { setBy("language"); setDeck(null); }}
                className={`flex-1 rounded-xl px-3 py-1.5 font-bold ${by === "language" ? "bg-ink text-cream" : "border-2 border-ink/15"}`}>
                By language
              </button>
            </div>

            <p className="text-xs font-bold text-ink/60">Pick a deck</p>
            <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
              {decks.map((d) => (
                <button key={d.value} onClick={() => setDeck(d.value)}
                  className={`rounded-xl border-2 p-2 text-left text-sm ${deck === d.value ? "border-beak bg-white/70" : "border-ink/10 bg-white/40"}`}>
                  <span className="mr-1">{d.icon}</span>
                  <span className="font-bold">{d.label}</span>
                  <span className="ml-1 text-xs text-ink/40">{d.meta}</span>
                </button>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              {(Object.keys(KIND_LABEL) as MediaKind[]).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={kinds.has(k)}
                    onChange={(e) => setKinds((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(k); else next.delete(k);
                      return next;
                    })} />
                  {KIND_LABEL[k]}
                  <span className="text-xs text-ink/50">
                    {cost.perKind[k] ?? "—"}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-ink/60">
                <input type="checkbox" disabled /> Video — coming in v2
              </label>
              <label className="flex items-center gap-2 text-ink/60">
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                Skip cards that already have it
              </label>
            </div>

            {deck && requested.length > 0 && (
              <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-3 text-sm">
                {estimate.cards === 0 ? (
                  <p className="font-bold">Nothing to generate — every card already has it. 🎉</p>
                ) : estimate.freeEverything ? (
                  <>
                    <p className="font-bold">{estimate.cards} cards → 0 Schwanki credits — provider costs apply:</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-ink/60">
                      {requested.includes("sentence") && (
                        <li>
                          sentences {cost.sentenceTotal
                            ? `≈ ${cost.sentenceTotal} total${cost.sentenceModel ? ` (${cost.sentenceModel} at live rates)` : ""}`
                            : "on your key"}
                        </li>
                      )}
                      {requested.includes("image") && <li>{cost.perKind.image}</li>}
                      {requested.includes("audio") && <li>{cost.perKind.audio}</li>}
                    </ul>
                  </>
                ) : (
                  <p className="font-bold">{estimate.cards} cards → {estimate.credits} credit{estimate.credits === 1 ? "" : "s"}</p>
                )}
                <p className="text-xs text-ink/50">
                  balance: {balance}
                  {estimate.credits > 0 && ` · ${estimate.cards} cards run one at a time in this tab`}
                </p>
                {notEnough && estimate.cards > 0 && (
                  <p className="mt-1 text-xs font-bold text-beak">
                    Not enough credits — <Link to="/settings" className="underline">add a key (free forever)</Link> or top up.
                  </p>
                )}
              </div>
            )}

            <button onClick={() => void start()}
              disabled={!deck || requested.length === 0 || estimate.cards === 0 || notEnough}
              className="w-full rounded-xl bg-beak px-4 py-2.5 font-bold text-cream disabled:opacity-40">
              {!deck
                ? "Pick a deck above"
                : requested.length === 0
                  ? "Pick at least one kind"
                  : estimate.cards === 0
                    ? "All done 🎉"
                    : notEnough
                      ? "Not enough credits"
                      : `Generate ${estimate.cards} card${estimate.cards === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
