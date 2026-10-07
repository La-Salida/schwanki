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

export function SourceForm({ onAdded, pdfTeacher }: {
  onAdded: (source: Source) => void;
  pdfTeacher?: { label: string; language: string } | undefined;
}) {
  const [mode, setMode] = useState<Mode>("google");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [classDate, setClassDate] = useState("");
  const [language, setLanguage] = useState<string>("zh");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pdfTeacher) return;
    setMode("pdf"); setLabel(pdfTeacher.label); setLanguage(pdfTeacher.language);
    setFile(null); setClassDate(""); setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }, [pdfTeacher]);

  const detected = mode === "google" ? detectSourceType(url) : null;
  const needsFile = mode !== "google";

  async function submit() {
    setError(null);
    if (mode === "google" && (!detected || detected === "canva")) {
      setError("That's not a Google Doc or Sheet link. The goose is unimpressed."); return;
    }
    if (mode === "canva" && detectSourceType(url) !== "canva") {
      setError("That's not a Canva design link. It should look like canva.com/design/…"); return;
    }
    if (needsFile && !file) { setError("Choose a PDF file first."); return; }
    if (file && file.size > MAX_PDF_BYTES) { setError("That PDF is over 10 MB — export a smaller one."); return; }
    if (mode === "pdf" && !label.trim()) { setError("Enter your teacher's name first."); return; }
    if (mode === "pdf" && !classDateFromFilename(`${classDate}.pdf`)) { setError("Choose the date of this class first."); return; }

    setBusy(true);
    try {
      const externalRef = mode === "canva" ? url : mode === "pdf" ? file!.name : url;
      const type = mode === "google" ? (detected as "google_sheet" | "google_doc") : "pdf_upload";
      const sourceLabel = mode === "pdf" ? `${label.trim()} · ${classDate}` : label || "Untitled source";
      const source = await api.addSource({ type, externalRef, label: sourceLabel, language });
      if (needsFile) await api.uploadSourcePdf(source.id, file!);
      setUrl(""); setFile(null); setClassDate(""); setError(null);
      if (mode !== "pdf") setLabel("");
      if (fileInput.current) fileInput.current.value = "";
      onAdded(source);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const tabCls = (m: Mode) =>
    `rounded-xl px-3 py-2 text-sm font-bold transition ${mode === m ? "bg-ink text-cream" : "bg-cream text-ink/60 hover:text-ink"}`;

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-3">
      <div className="flex gap-2">
        <button type="button" className={tabCls("google")} onClick={() => setMode("google")}>Google link</button>
        <button type="button" className={tabCls("pdf")} onClick={() => setMode("pdf")}>PDF upload</button>
        <button type="button" className={tabCls("canva")} onClick={() => setMode("canva")}>Canva + PDF</button>
      </div>

      {mode === "google" && (
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a Google Doc or Sheet link"
          className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
      )}
      {mode === "canva" && (
        <>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste the Canva link (canva.com/design/…)"
            className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
          <p className="text-sm text-ink/60">In Canva: Share → Download → PDF Standard, then drop the file here.</p>
        </>
      )}
      {needsFile && (
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" aria-label="PDF file"
          onChange={(e) => {
            const nextFile = e.target.files?.[0] ?? null;
            setFile(nextFile);
            if (mode === "pdf") setClassDate(nextFile ? classDateFromFilename(nextFile.name) ?? "" : "");
          }}
          className="w-full rounded-xl border border-dashed border-ink/30 bg-cream px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-1 file:text-cream" />
      )}
      {mode === "google" && detected && (
        <p className="text-sm">Detected: {detected === "google_sheet" ? "📊 Sheet" : "📄 Doc"}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          aria-label={mode === "pdf" ? "Teacher name" : "Source label"}
          placeholder={mode === "pdf" ? "Teacher name" : "Label (e.g. Preply — Kru May)"}
          className="min-w-0 flex-1 rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          aria-label="Language"
          className="rounded-xl border border-ink/20 bg-cream px-3 py-3">
          {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      {mode === "pdf" && (
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm font-bold">
            Class date
            <input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)}
              className="rounded-xl border border-ink/20 bg-cream px-3 py-2" />
          </label>
          <p className="text-sm text-ink/60">Upload one PDF per class. Earlier classes keep their own files and flashcards. Check the class date suggested from the filename.</p>
        </div>
      )}
      {error && <p className="text-sm text-beak">{error}</p>}
      <button onClick={() => void submit()} disabled={busy}
        className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-cream hover:bg-beak transition disabled:opacity-50">
        {busy ? (mode === "google" ? "Connecting…" : "Uploading…") : mode === "pdf" ? "Import class PDF" : "Connect source"}
      </button>
    </div>
  );
}
