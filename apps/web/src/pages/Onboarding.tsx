import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Source } from "@schwanki/core";
import { SourceForm } from "@/components/SourceForm";
import { AnkiImport } from "@/components/AnkiImport";
import { syncSource } from "@/lib/sync";
import { LANGUAGE_NAMES } from "@/lib/groupSources";

const LANGS = Object.entries(LANGUAGE_NAMES);

const SKIP_KEY = "schwanki_onboarding_done";

export function onboardingDismissed(): boolean {
  return localStorage.getItem(SKIP_KEY) === "1";
}

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [path, setPath] = useState<"choose" | "anki" | "notes">("choose");
  const [step, setStep] = useState<0 | 1>(0);
  const [imported, setImported] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [language, setLanguage] = useState("zh");
  const [importing, setImporting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const navigate = useNavigate();

  const pdfTeacher = useMemo(() => ({ label: teacher, language }), [teacher, language]);

  async function onUploaded(added: Source[]) {
    setImporting(true);
    setSyncError(null);
    let wordsFound = false;
    try {
      for (const source of added) {
        if (source.type !== "pdf_upload") continue;
        const result = await syncSource(source);
        if (result.startsWith("diffed:") && result !== "diffed:0") wordsFound = true;
      }
      localStorage.setItem(SKIP_KEY, "1");
      onFinish();
      // Straight to the payoff: the vocabulary pulled out of their class PDFs.
      navigate("/inbox", wordsFound ? undefined : { state: { onboardingDone: true } });
    } catch (e) {
      setSyncError(`Uploaded, but reading the PDFs failed: ${e instanceof Error ? e.message : "unknown"}. You can retry from Sources.`);
    } finally {
      setImporting(false);
    }
  }

  function skip() {
    localStorage.setItem(SKIP_KEY, "1");
    onFinish();
    navigate("/");
  }

  return (
    <main id="main-content" className="page-shell max-w-2xl space-y-6">
      <header className="page-header">
        <h1>Welcome to Schwanki</h1>
        <p>Bring the decks you already study, or turn your class notes into flashcards. You can add more of either later.</p>
      </header>

      {path === "choose" && (
        <div className="space-y-3">
          <h2 className="text-xl font-black">How do you want to start?</h2>
          <button type="button" onClick={() => setPath("anki")} className="paper-panel block w-full text-left transition-colors hover:border-beak">
            <span className="block text-lg font-black">Import my Anki decks</span>
            <span className="block text-sm text-ink/60">Bring your cards, media, and review history. We’ll show you how to export from your computer, iPhone, or Android.</span>
          </button>
          <button type="button" onClick={() => setPath("notes")} className="paper-panel block w-full text-left transition-colors hover:border-beak">
            <span className="block text-lg font-black">Turn class notes into cards</span>
            <span className="block text-sm text-ink/60">PDFs, Google Docs or Sheets from your teacher or course. New words wait in your Inbox for a quick check.</span>
          </button>
          <button type="button" className="text-sm font-bold underline" onClick={skip}>Skip for now</button>
        </div>
      )}

      {path === "anki" && (
        <div className="space-y-3">
          <AnkiImport onImported={() => setImported(true)} />
          {imported ? (
            <button type="button" className="primary-button w-full" onClick={skip}>Start reviewing</button>
          ) : (
            <button type="button" className="text-sm font-bold underline" onClick={() => setPath("choose")}>Back</button>
          )}
        </div>
      )}

      {path === "notes" && (
      <ol className="flex gap-2 text-sm font-bold" aria-label="Setup steps">
        <li className={`rounded-xl px-3 py-2 ${step === 0 ? "bg-ink text-cream" : "bg-cream text-ink/60"}`}>1 · Your teacher</li>
        <li className={`rounded-xl px-3 py-2 ${step === 1 ? "bg-ink text-cream" : "bg-cream text-ink/60"}`}>2 · Class PDFs</li>
      </ol>
      )}

      {path === "notes" && step === 0 && (
        <form className="paper-panel space-y-4" onSubmit={(e) => { e.preventDefault(); if (teacher.trim()) setStep(1); }}>
          <h2 className="text-xl font-black">Who are you learning with?</h2>
          <label className="block space-y-1 text-sm font-bold">Teacher name
          <input value={teacher} onChange={(e) => setTeacher(e.target.value)} autoFocus
            placeholder="e.g. Mei laoshi"
            className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" /></label>
          <label className="block space-y-1 text-sm font-bold">Language
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="block w-full rounded-xl border border-ink/20 bg-cream px-3 py-3">
            {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select></label>
          <p className="text-sm text-ink/60">Taking lessons on Preply? The Chrome extension can also capture your lessons and chats with this teacher.</p>
          <button type="submit" disabled={!teacher.trim()} className="primary-button w-full">Next: add class PDFs</button>
        </form>
      )}

      {path === "notes" && step === 1 && (
        <div className="space-y-3">
          {importing ? (
            <p role="status" className="notice">Reading your class PDFs and pulling out the vocabulary…</p>
          ) : (
            <SourceForm onAdded={(sources) => void onUploaded(sources)} pdfTeacher={pdfTeacher} />
          )}
          {syncError && <p role="alert" className="error-notice">{syncError}</p>}
          <div className="flex justify-between text-sm font-bold">
            <button type="button" className="underline" onClick={() => setStep(0)}>Back</button>
            <button type="button" className="underline" onClick={skip}>Skip — I'll add notes later</button>
          </div>
        </div>
      )}

      {path === "notes" && step === 0 && (
        <button type="button" className="text-sm font-bold underline" onClick={() => setPath("choose")}>Back</button>
      )}
    </main>
  );
}
