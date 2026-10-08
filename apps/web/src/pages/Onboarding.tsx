import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Source } from "@schwanki/core";
import { SourceForm } from "@/components/SourceForm";
import { syncSource } from "@/lib/sync";

const LANGS = [
  ["zh", "Chinese"], ["th", "Thai"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["ja", "Japanese"], ["ko", "Korean"], ["en", "English"],
] as const;

const SKIP_KEY = "schwanki_onboarding_done";

export function onboardingDismissed(): boolean {
  return localStorage.getItem(SKIP_KEY) === "1";
}

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
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
        <p>Two minutes of setup and your class notes start turning into flashcards.</p>
      </header>
      <ol className="flex gap-2 text-sm font-bold" aria-label="Setup steps">
        <li className={`rounded-xl px-3 py-2 ${step === 0 ? "bg-ink text-cream" : "bg-cream text-ink/60"}`}>1 · Your teacher</li>
        <li className={`rounded-xl px-3 py-2 ${step === 1 ? "bg-ink text-cream" : "bg-cream text-ink/60"}`}>2 · Class PDFs</li>
      </ol>

      {step === 0 && (
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
          <p className="text-sm text-ink/60">Learning on Preply? The Chrome extension captures your lessons and chats with this teacher automatically.</p>
          <button type="submit" disabled={!teacher.trim()} className="primary-button w-full">Next: add class PDFs</button>
        </form>
      )}

      {step === 1 && (
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

      {step === 0 && (
        <button type="button" className="text-sm font-bold underline" onClick={skip}>Skip for now</button>
      )}
    </main>
  );
}
