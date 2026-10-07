import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { MediaKind, Source } from "@schwanki/core";
import type { Provider } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { loadModelCatalog, type ModelCatalog } from "@/lib/catalog";
import { deckCards, enqueueBulk, estimateBulk, existingKindsByCard, providerCost, runsForDeck, type CardRef, type DeckScope } from "@/lib/bulk";
import { SOURCE_ICON, flagFor } from "@/lib/meta";
import { useDialog } from "@/lib/useDialog";

const KIND_LABEL: Record<MediaKind, string> = {
  sentence: "Memorable sentences",
  image: "Scene images",
  audio: "Pronunciation audio",
};

/** Deck-wide mnemonic generation: pick a deck (teacher or language), see the exact
 *  credit cost, then enqueue — a cron'd worker generates server-side while the
 *  background banner on the Review page tracks progress. The tab can close. */
export function BulkGenerateModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog(onClose);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refs, setRefs] = useState<CardRef[] | null>(null);
  const [existing, setExisting] = useState<Map<string, Set<MediaKind>> | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [savedProviders, setSavedProviders] = useState<Provider[]>([]);
  const [balance, setBalance] = useState(0);
  const [by, setBy] = useState<"source" | "language">("source");
  const [deck, setDeck] = useState<string | null>(null);
  const [kinds, setKinds] = useState<Set<MediaKind>>(new Set(["sentence", "image", "audio"]));
  const [skipExisting, setSkipExisting] = useState(true);
  const [enqueueing, setEnqueueing] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalog["catalog"]>({});

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
    })().catch(() => setLoadError("Couldn't load your decks or generation settings. Close this window and try again."));
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
    // Async: enqueue server-side and hand progress to the background banner —
    // the tab can close; the cron'd worker drains the queue.
    setEnqueueing(true);
    setEnqueueError(null);
    const enqueued = await enqueueBulk(runs.map((r) => ({ cardId: r.cardId, kinds: r.kinds })));
    if (enqueued === runs.length) {
      onClose(); // banner on the Review page takes over from here
      return;
    }
    setEnqueueing(false);
    setEnqueueError(
      enqueued > 0
        ? `Only ${enqueued} of ${runs.length} cards got queued. Press Generate again to queue the rest.`
        : "Couldn't queue the run. Check your connection and try again.",
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bulk-title" onClick={(e) => e.stopPropagation()}
        className="dialog-panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="bulk-title" className="text-xl font-black">Generate for a deck</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-ink/50 hover:bg-ink/5">close</button>
        </div>

        {loadError ? <p role="alert" className="error-notice">{loadError}</p> : refs === null || existing === null ? (
          <p role="status" className="p-4 text-center text-sm text-ink/50">Loading your cards and generation settings…</p>
        ) : refs.length === 0 ? (
          <p className="notice">No cards to generate for yet. <Link to="/inbox" onClick={onClose} className="font-bold underline">Approve class words in the Inbox</Link> first.</p>
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
                    {cost.perKind[k] ?? "Not estimated"}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-ink/60">
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                Skip cards that already have it
              </label>
            </div>

            {deck && requested.length > 0 && (
              <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-3 text-sm">
                {estimate.cards === 0 ? (
                  <p className="font-bold">Nothing to generate. Every card already has it.</p>
                ) : estimate.freeEverything ? (
                  <>
                    <p className="font-bold">{estimate.cards} cards, 0 Schwanki credits. Provider costs apply:</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-ink/60">
                      {cost.lines.map((l) => <li key={l.kind}>{l.text}</li>)}
                    </ul>
                    <p className="mt-1 text-[10px] text-ink/40">
                      Images and audio use estimated provider rates. Check your provider's current prices.
                    </p>
                  </>
                ) : (
                  <p className="font-bold">{estimate.cards} cards → {estimate.credits} credit{estimate.credits === 1 ? "" : "s"}</p>
                )}
                <p className="text-xs text-ink/50">
                  balance: {balance}
                  {estimate.credits > 0 && ` · runs in the background; you can close the tab`}
                </p>
                {notEnough && estimate.cards > 0 && (
                  <p className="mt-1 text-xs font-bold text-beak">
                    Not enough credits. <Link to="/settings" className="underline" onClick={onClose}>Add a provider key in Settings</Link>. Provider charges apply.
                  </p>
                )}
              </div>
            )}

            {enqueueError && <p role="alert" className="text-sm font-bold text-beak">{enqueueError}</p>}

            <button onClick={() => void start()}
              disabled={enqueueing || !deck || requested.length === 0 || estimate.cards === 0 || notEnough}
              className="w-full rounded-xl bg-beak px-4 py-2.5 font-bold text-cream disabled:opacity-40">
              {enqueueing
                ? "Queueing…"
                : !deck
                ? "Pick a deck above"
                : requested.length === 0
                  ? "Pick at least one kind"
                  : estimate.cards === 0
                    ? "Nothing to generate"
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
