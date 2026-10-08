import { useEffect, useRef, useState } from "react";
import type { Source } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { detectSourceType } from "@/lib/detectSource";
import { classDateFromFilename } from "@/lib/classPdf";

const LANGS = [
  ["zh", "Chinese"], ["th", "Thai"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["ja", "Japanese"], ["ko", "Korean"], ["en", "English"],
] as const;

type Mode = "google" | "pdf" | "canva";
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB upload guard
type PdfPick = { file: File; date: string };

export function SourceForm({ onAdded, pdfTeacher }: {
  onAdded: (sources: Source[]) => void;
  pdfTeacher?: { label: string; language: string } | undefined;
}) {
  const [mode, setMode] = useState<Mode>("google");
  const [url, setUrl] = useState("");
  const [picks, setPicks] = useState<PdfPick[]>([]);
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState<string>("zh");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pdfTeacher) return;
    setMode("pdf"); setLabel(pdfTeacher.label); setLanguage(pdfTeacher.language);
    setPicks([]); setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }, [pdfTeacher]);

  const detected = mode === "google" ? detectSourceType(url) : null;
  const needsFile = mode !== "google";
  const multi = mode === "pdf";

  function pickFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (multi) {
      setPicks(files.map((file) => ({ file, date: classDateFromFilename(file.name) ?? "" })));
    } else {
      setPicks(files.length > 0 ? [{ file: files[0]!, date: "" }] : []);
    }
  }

  async function submit() {
    setError(null);
    if (mode === "google" && (!detected || detected === "canva")) {
      setError("That's not a Google Doc or Sheet link. The goose is unimpressed."); return;
    }
    if (mode === "canva" && detectSourceType(url) !== "canva") {
      setError("That's not a Canva design link. It should look like canva.com/design/…"); return;
    }
    if (needsFile && picks.length === 0) { setError("Choose a PDF file first."); return; }
    if (picks.some((p) => p.file.size > MAX_PDF_BYTES)) { setError("One of those PDFs is over 10 MB. Export a smaller one."); return; }
    if (mode === "pdf" && !label.trim()) { setError("Enter your teacher's name first."); return; }
    if (mode === "pdf" && picks.some((p) => !classDateFromFilename(`${p.date}.pdf`))) {
      setError("Every PDF needs the date of its class. Check the dates beside each file."); return;
    }

    setBusy(true);
    try {
      if (mode === "pdf") {
        const sources: Source[] = [];
        for (const pick of picks) {
          const source = await api.addSource({
            type: "pdf_upload",
            externalRef: pick.file.name,
            label: `${label.trim()} · ${pick.date}`,
            language,
          });
          await api.uploadSourcePdf(source.id, pick.file);
          sources.push(source);
        }
        setPicks([]); setError(null);
        if (fileInput.current) fileInput.current.value = "";
        onAdded(sources);
      } else {
        const type = mode === "canva" ? "pdf_upload" : (detected as "google_sheet" | "google_doc");
        const source = await api.addSource({ type, externalRef: url, label: label || "Untitled source", language });
        if (mode === "canva") await api.uploadSourcePdf(source.id, picks[0]!.file);
        setUrl(""); setPicks([]); setLabel(""); setError(null);
        if (fileInput.current) fileInput.current.value = "";
        onAdded([source]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const tabCls = (m: Mode) =>
    `rounded-xl px-3 py-2 text-sm font-bold transition ${mode === m ? "bg-ink text-cream" : "bg-cream text-ink/60 hover:text-ink"}`;

  return (
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="paper-panel space-y-4">
      <h2 className="text-xl font-black">Add class notes</h2>
      <div className="flex flex-wrap gap-2" aria-label="Source format">
        <button type="button" className={tabCls("google")} onClick={() => setMode("google")}>Google link</button>
        <button type="button" className={tabCls("pdf")} onClick={() => setMode("pdf")}>PDF upload</button>
        <button type="button" className={tabCls("canva")} onClick={() => setMode("canva")}>Canva + PDF</button>
      </div>

      {mode === "google" && (
        <label className="block space-y-1 text-sm font-bold">Google Doc or Sheet link
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a Google Doc or Sheet link"
          className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" /></label>
      )}
      {mode === "canva" && (
        <>
          <label className="block space-y-1 text-sm font-bold">Canva design link
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste the Canva link (canva.com/design/…)"
            className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" /></label>
          <p className="text-sm text-ink/60">In Canva, choose Share, Download, then PDF Standard. Upload that file here.</p>
        </>
      )}
      {needsFile && (
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" multiple={multi} aria-label="PDF files"
          onChange={(e) => pickFiles(e.target.files)}
          className="w-full rounded-xl border border-dashed border-ink/30 bg-cream px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-1 file:text-cream" />
      )}
      {mode === "pdf" && picks.length > 0 && (
        <ul className="space-y-2">
          {picks.map((pick, i) => (
            <li key={`${pick.file.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-bold" title={pick.file.name}>{pick.file.name}</span>
              <label className="flex items-center gap-2 font-bold">Class date
                <input type="date" value={pick.date} aria-label={`Class date for ${pick.file.name}`}
                  onChange={(e) => setPicks(picks.map((p, j) => j === i ? { ...p, date: e.target.value } : p))}
                  className="rounded-xl border border-ink/20 bg-cream px-2 py-1" />
              </label>
            </li>
          ))}
        </ul>
      )}
      {mode === "google" && detected && (
        <p className="text-sm">Detected: {detected === "google_sheet" ? "Google Sheet" : "Google Doc"}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1 space-y-1 text-sm font-bold">{mode === "pdf" ? "Teacher name" : "Source label"}
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          aria-label={mode === "pdf" ? "Teacher name" : "Source label"}
          placeholder={mode === "pdf" ? "Teacher name" : "Your teacher or class name"}
          className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" /></label>
        <label className="space-y-1 text-sm font-bold">Language
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          aria-label="Language"
          className="block w-full rounded-xl border border-ink/20 bg-cream px-3 py-3">
          {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select></label>
      </div>
      {mode === "pdf" && (
        <p className="text-sm text-ink/60">Upload one PDF per class — you can select several at once. Each becomes its own class with its own flashcards. Dates are read from filenames; fix any that look wrong.</p>
      )}
      {error && <p role="alert" className="error-notice">{error}</p>}
      <button type="submit" disabled={busy} className="primary-button w-full">
        {busy ? (mode === "google" ? "Connecting…" : "Uploading…")
          : mode === "pdf" ? (picks.length > 1 ? `Import ${picks.length} class PDFs` : "Import class PDF")
          : "Connect source"}
      </button>
    </form>
  );
}
