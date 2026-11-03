import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import type { MediaKind } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { ANY_TEACHER, AUTO_OFF, DEFAULT_DAILY_LIMIT, deckKey, loadAutoGenerate, saveAutoGenerate, teacherChoices, type AutoGenerateSettings, type LanguageTeachers } from "@/lib/autoGenerate";
import { languageName } from "@/lib/groupSources";
import { flagFor } from "@/lib/meta";

const KINDS: Array<[MediaKind, string]> = [["sentence", "Example sentence"], ["image", "Picture"], ["audio", "Audio"]];

/** Opt-in: make memory aids for new words as they join the decks picked here. */
export function AutoGenerateSetting() {
  const title = useId();
  const [choices, setChoices] = useState<LanguageTeachers[] | null>(null);
  const [saved, setSaved] = useState<AutoGenerateSettings>(AUTO_OFF);
  const [draft, setDraft] = useState<AutoGenerateSettings>(AUTO_OFF);
  const [limitText, setLimitText] = useState(String(DEFAULT_DAILY_LIMIT));
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    void Promise.all([loadAutoGenerate(), api.listSources(), api.listTeachers()])
      .then(([s, sources, teachers]) => {
        setSaved(s); setDraft(s); setLimitText(String(s.dailyLimit));
        setChoices(teacherChoices(sources, teachers));
      })
      .catch(() => setLoadError(true));
  }, []);

  const decks = new Set(draft.decks);
  const toggleDeck = (key: string, on: boolean) => {
    const next = new Set(decks);
    if (on) next.add(key); else next.delete(key);
    setDraft({ ...draft, decks: [...next] }); setStatus("idle");
  };
  const toggleKind = (kind: MediaKind, on: boolean) => {
    const next = on ? [...draft.kinds, kind] : draft.kinds.filter((k) => k !== kind);
    setDraft({ ...draft, kinds: KINDS.map(([k]) => k).filter((k) => next.includes(k)) }); setStatus("idle");
  };
  const limit = Number(limitText);
  const limitValid = Number.isInteger(limit) && limit >= 1 && limit <= 500;
  const next = { ...draft, dailyLimit: limitValid ? limit : draft.dailyLimit };
  const changed = JSON.stringify([...next.decks].sort()) !== JSON.stringify([...saved.decks].sort())
    || next.kinds.join() !== saved.kinds.join() || next.dailyLimit !== saved.dailyLimit;
  const on = saved.decks.length > 0;
  const paid = draft.kinds.includes("image") || draft.kinds.includes("audio");

  async function save(settings: AutoGenerateSettings) {
    setStatus("saving");
    try {
      await saveAutoGenerate(settings);
      setSaved(settings); setDraft(settings); setLimitText(String(settings.dailyLimit)); setStatus("saved");
    } catch { setStatus("error"); }
  }

  return (
    <section aria-labelledby={title} className="space-y-4">
      <div>
        <h2 id={title} className="text-2xl font-black">Make memory aids automatically</h2>
        <p className="mt-2 text-sm text-ink/70">When new words from your class notes join one of the decks you pick, Schwanki makes their memory aids for you. Words already in your decks are left as they are. {on ? "On." : "Off."}</p>
      </div>
      {loadError && <p role="alert" className="text-sm font-bold text-margin">Couldn't load this setting. Reload the page to try again.</p>}
      {!loadError && choices === null && <p role="status" className="text-sm">Loading your teachers…</p>}
      {choices !== null && choices.length === 0 && (
        <p className="text-sm">Add class notes in <Link to="/sources" className="font-bold underline">Decks &amp; notes</Link> first, then pick the teachers here.</p>
      )}
      {choices !== null && choices.length > 0 && <>
        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-bold">Which decks</legend>
          {choices.map(({ language, teachers }) => {
            const all = decks.has(`${ANY_TEACHER}|${language}`);
            return (
              <div key={language} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={all} onChange={(e) => toggleDeck(`${ANY_TEACHER}|${language}`, e.target.checked)} />
                  <span aria-hidden="true">{flagFor(language)}</span> Every {languageName(language)} teacher, including new ones
                </label>
                <ul className="ml-6 space-y-1">
                  {teachers.map((t) => (
                    <li key={t}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" disabled={all} checked={all || decks.has(deckKey(t, language))}
                          onChange={(e) => toggleDeck(deckKey(t, language), e.target.checked)} />
                        {t}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold">What to make</legend>
          {KINDS.map(([kind, label]) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.kinds.includes(kind)} disabled={draft.kinds.length === 1 && draft.kinds.includes(kind)}
                onChange={(e) => toggleKind(kind, e.target.checked)} />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm font-bold">Most new words a day
          <input type="number" inputMode="numeric" min={1} max={500} step={1} value={limitText} aria-invalid={!limitValid}
            onChange={(e) => { setLimitText(e.target.value); setStatus("idle"); }} className="review-display-input mt-2 block w-32" />
        </label>
        {!limitValid && <p className="text-sm font-bold text-margin">Enter a whole number from 1 to 500.</p>}
        <p className="text-sm text-ink/70">
          {paid
            ? `On Schwanki AI, a word with a picture or audio costs 1 credit, so this spends at most ${limitValid ? limit : draft.dailyLimit} credits a day. Your own keys cost no credits.`
            : "Example sentences are free for 50 a day, then 1 credit each. Your own keys cost no credits."}
          {" "}If you run out of credits, it pauses until you top up. Words that arrive while it's paused can be filled in from Decks &amp; notes.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="primary-button" disabled={!changed || !limitValid || status === "saving"} onClick={() => void save(next)}>
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          {on && <button className="secondary-button" disabled={status === "saving"} onClick={() => void save({ ...saved, decks: [] })}>Turn off</button>}
          {status === "saved" && <p role="status" className="text-sm font-bold">{saved.decks.length > 0 ? "Saved. New words in these decks get memory aids." : "Turned off."}</p>}
          {status === "error" && <p role="alert" className="text-sm font-bold text-margin">Couldn't save. Check your connection and try again.</p>}
        </div>
      </>}
    </section>
  );
}
