import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { MediaKind, Source } from "@schwanki/core";
import type { Provider } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { loadModelCatalog, type ModelCatalog } from "@/lib/catalog";
import { PREVIEW_SIZE, clearPreviewRest, deckCards, enqueueBulk, estimateBulk, existingKindsByCard, providerCost, runsForDeck, savePreviewRest, type CardRef, type DeckScope } from "@/lib/bulk";
import { flagFor } from "@/lib/meta";
import { groupByTeacher, languageName, teacherKey } from "@/lib/groupSources";
import { useDialog } from "@/lib/useDialog";

const KIND_LABEL: Record<MediaKind, string> = {
  sentence: "Memorable sentences",
  image: "Scene images",
  audio: "Pronunciation audio",
};

/** Deck-wide mnemonic generation: pick a deck (teacher or language), see the exact
 *  credit cost, then enqueue — a cron'd worker generates server-side while the
 *  background banner on the Review page tracks progress. The tab can close. */
/** The user's own cards (no class source) form one deck per language, as on the Today page. */
const OWN_CARDS = "Your own cards";

export function BulkGenerateModal({ onClose, initialDeck }: {
  onClose: () => void;
  /** Open with this Today-page deck already picked. */
  initialDeck?: { teacher: string; language: string } | undefined;
}) {
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
      const teacherDecks = groupByTeacher(s.filter((src) => r.some((x) => x.sourceId === src.id)))
        .flatMap((t) => t.languages.map((l) => `${t.teacher}|${l.language}`));
      if (teacherDecks.length === 1 && !initialDeck) setDeck(teacherDecks[0]!);
    })().catch(() => setLoadError("Couldn't load your decks or generation settings. Close this window and try again."));
  }, []);

  const decks = useMemo(() => {
    if (!refs) return [];
    if (by === "source") {
      // Same decks as the Today page: one per teacher and language, across all of their classes.
      const teacherDecks = groupByTeacher(sources.filter((src) => refs.some((r) => r.sourceId === src.id)))
        .flatMap((t) => t.languages.map((l) => {
          const ids = l.items.map((src) => src.id);
          return { value: `${t.teacher}|${l.language}`, label: t.teacher, icon: flagFor(l.language),
            meta: `${languageName(l.language)} · ${refs.filter((r) => r.sourceId !== null && ids.includes(r.sourceId)).length} cards`,
            sourceIds: ids as Array<string | null>, language: undefined as string | undefined };
        }));
      const own = new Map<string, number>();
      for (const r of refs) if (r.sourceId === null) own.set(r.language, (own.get(r.language) ?? 0) + 1);
      const ownDecks = [...own.entries()].map(([language, count]) => ({
        value: `${OWN_CARDS}|${language}`, label: OWN_CARDS, icon: flagFor(language),
        meta: `${languageName(language)} · ${count} cards`, sourceIds: [null] as Array<string | null>, language: language as string | undefined,
      }));
      return [...teacherDecks, ...ownDecks];
    }
    const langs = new Map<string, number>();
    for (const r of refs) langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
    return [...langs.entries()]
      .map(([value, count]) => ({ value, label: languageName(value), icon: flagFor(value), meta: `${count} cards`,
        sourceIds: [] as Array<string | null>, language: undefined as string | undefined }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }, [refs, sources, by]);

  // Coming from a deck's own button: pick that deck once the list is built.
  const appliedInitial = useRef(false);
  useEffect(() => {
    if (!initialDeck || appliedInitial.current || decks.length === 0 || by !== "source") return;
    appliedInitial.current = true;
    const match = decks.find((d) => teacherKey(d.label) === teacherKey(initialDeck.teacher) && d.value.endsWith(`|${initialDeck.language}`));
    if (match) setDeck(match.value);
  }, [initialDeck, decks, by]);

  const runs = useMemo(() => {
    if (!refs || !existing || !deck) return [];
    const picked = decks.find((d) => d.value === deck);
    const scope: DeckScope = by === "source"
      ? { by: "sources", value: picked?.sourceIds ?? [], ...(picked?.language ? { language: picked.language } : {}) }
      : { by: "language", value: deck };
    return runsForDeck(deckCards(refs, scope), existing, [...kinds], skipExisting);
  }, [refs, existing, deck, decks, kinds, skipExisting, by]);

  const estimate = useMemo(() => estimateBulk(runs, savedProviders), [runs, savedProviders]);
  const cost = useMemo(() => providerCost(runs, [...kinds], savedProviders, catalog), [runs, kinds, savedProviders, catalog]);
  const requested = [...kinds];
  const notEnough = estimate.credits > balance;

  // A preview makes the first few cards only; the progress panel offers the rest
  // once they can be seen, so a wrong style costs a few credits, not the deck.
  const previewEstimate = useMemo(() => estimateBulk(runs.slice(0, PREVIEW_SIZE), savedProviders), [runs, savedProviders]);
  // Offered on its own cost: a preview is how someone with few credits sees the deck's look at all.
  const canPreview = runs.length > PREVIEW_SIZE && previewEstimate.credits <= balance;

  async function start(preview: boolean) {
    // Async: enqueue server-side and hand progress to the background banner —
    // the tab can close; the cron'd worker drains the queue.
    setEnqueueing(true);
    setEnqueueError(null);
    const jobs = runs.map((r) => ({ cardId: r.cardId, kinds: r.kinds }));
    const now = preview ? jobs.slice(0, PREVIEW_SIZE) : jobs;
    const enqueued = await enqueueBulk(now);
    if (enqueued === now.length) {
      if (preview) savePreviewRest(jobs.slice(PREVIEW_SIZE)); else clearPreviewRest();
      onClose(); // banner on the Review page takes over from here
      return;
    }
    setEnqueueing(false);
    setEnqueueError(
      enqueued > 0
        ? `Only ${enqueued} of ${now.length} cards got queued. Press Generate again to queue the rest.`
        : "Couldn't queue the run. Try again, or sign out and back in if it keeps failing.",
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bulk-title" onClick={(e) => e.stopPropagation()}
        className="dialog-panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="bulk-title" className="text-xl font-black">Generate memory aids</h2>
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

            {canPreview && !enqueueing && deck && (
              <div className="space-y-1">
                <button onClick={() => void start(true)} disabled={enqueueing}
                  className="w-full rounded-xl bg-beak px-4 py-2.5 font-bold text-cream disabled:opacity-40">
                  Preview {PREVIEW_SIZE} cards first
                </button>
                <p className="text-center text-xs text-ink/50">
                  {previewEstimate.credits === 0 ? "Free" : `${previewEstimate.credits} credit${previewEstimate.credits === 1 ? "" : "s"}`} now.
                  See how they look, then make the other {estimate.cards - PREVIEW_SIZE} from the progress panel.
                </p>
              </div>
            )}
            <button onClick={() => void start(false)}
              disabled={enqueueing || !deck || requested.length === 0 || estimate.cards === 0 || notEnough}
              className={`w-full rounded-xl px-4 py-2.5 font-bold disabled:opacity-40 ${canPreview && deck ? "border-2 border-ink/20" : "bg-beak text-cream"}`}>
              {enqueueing
                ? "Queueing…"
                : !deck
                ? "Pick a deck above"
                : requested.length === 0
                  ? "Pick at least one kind"
                  : estimate.cards === 0
                    ? "Nothing to generate"
                    : notEnough
                      ? `Not enough credits for all ${estimate.cards}`
                      : `Generate ${canPreview ? "all " : ""}${estimate.cards} card${estimate.cards === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
