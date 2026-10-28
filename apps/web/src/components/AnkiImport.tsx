import { useId, useState } from "react";
import { LANGUAGE_NAMES } from "@/lib/groupSources";
import type { ImportProgress, ImportResult, OpenedDeckFile } from "@/lib/anki/import";
import { AnkiExportGuide } from "./AnkiExportGuide";

const LANGS = Object.entries(LANGUAGE_NAMES);
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

type Phase =
  | { step: "pick"; error?: string }
  | { step: "reading"; fileName: string }
  | { step: "preview"; opened: OpenedDeckFile; error?: string }
  | { step: "importing"; deck: string; progress: ImportProgress | null }
  | { step: "done"; totals: ImportResult };

/** Bring an Anki deck (.apkg/.colpkg) into Schwanki: cards, pictures, audio and review history. */
export function AnkiImport({ title = "Import an Anki deck", onImported, onClose }: {
  title?: string; onImported: (totals: ImportResult) => void; onClose?: (() => void) | undefined;
}) {
  const fileId = useId();
  const helpId = useId();
  const [phase, setPhase] = useState<Phase>({ step: "pick" });
  const [language, setLanguage] = useState("zh");
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhase({ step: "reading", fileName: file.name });
    try {
      // Loaded on demand: the SQLite reader is only needed here.
      const { openAnkiFile } = await import("@/lib/anki/import");
      const opened = await openAnkiFile(file);
      if (opened.plan.decks.length === 0) {
        setPhase({ step: "pick", error: "No cards in this file that Schwanki can use. Every note needs a word and a meaning." });
        return;
      }
      if (opened.language) setLanguage(opened.language);
      setChosen(new Set(opened.plan.decks.map((d) => d.name)));
      setPhase({ step: "preview", opened });
    } catch (e) {
      setPhase({ step: "pick", error: e instanceof Error ? e.message : "Couldn't read this file." });
    }
  }

  async function start(opened: OpenedDeckFile) {
    const { importDeck } = await import("@/lib/anki/import");
    const totals: ImportResult = { created: 0, duplicates: 0, mediaFailed: 0 };
    try {
      for (const deck of opened.plan.decks.filter((d) => chosen.has(d.name))) {
        setPhase({ step: "importing", deck: deck.name, progress: null });
        const result = await importDeck(opened, deck, language, (progress) => setPhase({ step: "importing", deck: deck.name, progress }));
        totals.created += result.created;
        totals.duplicates += result.duplicates;
        totals.mediaFailed += result.mediaFailed;
      }
      setPhase({ step: "done", totals });
      onImported(totals);
    } catch (e) {
      const done = totals.created > 0 ? ` ${plural(totals.created, "card")} made it in before that.` : "";
      setPhase({ step: "preview", opened, error: `Import stopped: ${e instanceof Error ? e.message : "unknown error"}.${done}` });
    }
  }

  return (
    <section className="paper-panel space-y-4" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="text-sm text-ink/60">Bring your cards, review history, pictures, and audio with a one-time export from Anki.</p>
        </div>
        {onClose && phase.step !== "importing" && <button type="button" onClick={onClose} className="text-sm font-bold text-ink/60 underline">Close</button>}
      </div>

      {phase.step === "pick" && (
        <>
          <AnkiExportGuide />
          <div className="anki-export-upload">
          <label htmlFor={fileId} className="block text-sm font-bold">Have your export? Choose your Anki file</label>
          <input id={fileId} type="file" accept=".apkg,.colpkg" aria-describedby={helpId}
            onChange={(e) => void pick(e.target.files?.[0])}
            className="w-full rounded-xl border border-dashed border-ink/30 bg-paper px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-1 file:text-paper" />
          <p id={helpId} className="text-xs text-ink/70">Choose an .apkg or .colpkg file. Files exported without scheduling information won’t include your review history. Pictures and audio need Include media turned on.</p>
          </div>
          {phase.error && <p role="alert" className="error-notice">{phase.error}</p>}
        </>
      )}

      {phase.step === "reading" && <p role="status" className="notice">Opening {phase.fileName}…</p>}

      {phase.step === "preview" && (() => {
        const { plan } = phase.opened;
        const selected = plan.decks.filter((d) => chosen.has(d.name));
        const cards = selected.reduce((n, d) => n + d.cards.length, 0);
        const left = [plan.suspended > 0 && plural(plan.suspended, "suspended card"), plan.skipped > 0 && plural(plan.skipped, "note") + " without a word and meaning"].filter(Boolean);
        return (
          <div className="space-y-4">
            <ul className="space-y-2" aria-label="Decks in this file">
              {plan.decks.map((deck) => (
                <li key={deck.name}>
                  <label className="flex items-center gap-3 rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm">
                    <input type="checkbox" checked={chosen.has(deck.name)} disabled={plan.decks.length === 1}
                      onChange={(e) => {
                        const next = new Set(chosen);
                        if (e.target.checked) next.add(deck.name); else next.delete(deck.name);
                        setChosen(next);
                      }} />
                    <span className="min-w-0 flex-1 truncate font-bold">{deck.name}</span>
                    <span className="text-ink/60">{plural(deck.cards.length, "card")}{deck.reviewed > 0 ? ` · ${deck.reviewed.toLocaleString()} studied` : ""}</span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="block space-y-1 text-sm font-bold">Language you're learning
              <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language"
                className="block w-full rounded-xl border border-ink/20 bg-paper px-3 py-3">
                {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            {left.length > 0 && <p className="text-sm text-ink/60">Left out: {left.join(" and ")}.</p>}
            <p className="text-sm text-ink/60">Cards you haven't studied yet arrive 20 a day, in the order Anki would show them.</p>
            {phase.error && <p role="alert" className="error-notice">{phase.error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={cards === 0} onClick={() => void start(phase.opened)} className="primary-button">
                Import {plural(cards, "card")}
              </button>
              <button type="button" onClick={() => setPhase({ step: "pick" })} className="text-sm font-bold text-ink/60 underline">Choose another file</button>
            </div>
          </div>
        );
      })()}

      {phase.step === "importing" && (
        <div role="status" className="notice space-y-2">
          <p className="font-bold">Importing {phase.deck}…</p>
          {phase.progress && (
            <>
              <p>{phase.progress.phase === "cards" ? "Cards" : "Pictures and audio"}: {phase.progress.done.toLocaleString()} of {phase.progress.total.toLocaleString()}</p>
              <progress className="w-full" max={phase.progress.total} value={phase.progress.done} />
            </>
          )}
        </div>
      )}

      {phase.step === "done" && (
        <p role="status" className="notice">
          Imported {plural(phase.totals.created, "card")}.
          {phase.totals.duplicates > 0 && ` ${plural(phase.totals.duplicates, "word")} you already had ${phase.totals.duplicates === 1 ? "was" : "were"} skipped.`}
          {phase.totals.mediaFailed > 0 && ` ${phase.totals.mediaFailed.toLocaleString()} ${phase.totals.mediaFailed === 1 ? "picture or sound" : "pictures and sounds"} couldn't be copied.`}
        </p>
      )}
    </section>
  );
}
