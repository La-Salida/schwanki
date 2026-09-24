import { useState } from "react";
import { api } from "@/lib/supabase";
import { detectSourceType } from "@/lib/detectSource";

const LANGS = [
  ["zh", "Chinese"], ["th", "Thai"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["ja", "Japanese"], ["ko", "Korean"], ["en", "English"],
] as const;

export function SourceForm({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState<string>("zh");
  const [error, setError] = useState<string | null>(null);
  const type = detectSourceType(url);

  async function submit() {
    if (!type) { setError("That's not a Google Doc or Sheet link. The goose is unimpressed."); return; }
    try {
      await api.addSource({ type, externalRef: url, label: label || "Untitled source", language });
      setUrl(""); setLabel(""); setError(null);
      onAdded();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4 space-y-3">
      <input value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a Google Doc or Sheet link"
        className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
      {type && <p className="text-sm">Detected: {type === "google_sheet" ? "📊 Sheet" : "📄 Doc"}</p>}
      <div className="flex gap-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Preply — Kru May)"
          className="flex-1 rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="rounded-xl border border-ink/20 bg-cream px-3 py-3">
          {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-beak">{error}</p>}
      <button onClick={() => void submit()}
        className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-cream hover:bg-beak transition">
        Connect source
      </button>
    </div>
  );
}
