import { useEffect, useRef, useState } from "react";
import type { CardEdits, CardHelpField } from "@schwanki/core";
import { supabase } from "@/lib/supabase";

export function CardEditor({ id, kind, initial, onSave, onCancel }: {
  id: string; kind: "candidate" | "card"; initial: CardEdits;
  onSave: (edits: CardEdits) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [guidance, setGuidance] = useState("");
  const [suggestion, setSuggestion] = useState<{ field: CardHelpField; value: string } | null>(null);
  const [asking, setAsking] = useState<CardHelpField | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);

  function invalidate() {
    version.current++; setSuggestion(null); setAsking(null); setError(null);
  }
  function edit(field: keyof CardEdits, value: string) {
    invalidate(); setDraft(current => ({ ...current, [field]: value }));
  }
  async function ask(field: CardHelpField) {
    const requestVersion = ++version.current;
    setAsking(field); setSuggestion(null); setError(null);
    try {
      const { data, error: failure } = await supabase.functions.invoke("suggest-card-field", {
        body: { id, kind, field, draft, guidance },
      });
      if (failure) throw new Error("AI help is unavailable right now. You can still edit manually.");
      if (data?.error) throw new Error(data.error);
      if (data?.field !== field || typeof data?.value !== "string" || !data.value.trim()) throw new Error("AI returned no usable suggestion.");
      if (version.current === requestVersion) setSuggestion({ field, value: data.value });
    } catch (failure) {
      if (version.current === requestVersion) setError((failure as Error).message);
    } finally {
      if (version.current === requestVersion) setAsking(null);
    }
  }
  async function save() {
    setError(null);
    if (!draft.front.trim() || !draft.back.trim()) { setError("Word and meaning are required."); return; }
    setSaving(true);
    try { await onSave({ front: draft.front.trim(), back: draft.back.trim(), reading: draft.reading.trim(), exampleSentence: draft.exampleSentence.trim() }); }
    catch (failure) { setError((failure as Error).message); setSaving(false); }
  }

  return (
    <div className="space-y-3 rounded-xl border border-ink/15 bg-cream p-4" role="group" aria-label="Edit vocabulary card">
      <label className="block text-sm font-bold">Word or phrase
        <input value={draft.front} onChange={e => edit("front", e.target.value)} disabled={saving}
          className="mt-1 w-full rounded border border-ink/20 px-3 py-2 text-lg" />
      </label>
      {([ ["reading", "Pinyin / pronunciation"], ["back", "English meaning"] ] as const).map(([field, label]) => (
        <div key={field} className="space-y-1">
          <label className="block text-sm font-bold">{label}
            <input value={draft[field]} onChange={e => edit(field, e.target.value)} disabled={saving}
              className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
          </label>
          <button type="button" onClick={() => void ask(field)} disabled={!draft.front.trim() || saving || asking !== null}
            className="text-sm font-bold underline disabled:opacity-40">
            {asking === field ? "Asking AI…" : field === "reading" ? "Suggest pronunciation" : "Suggest meaning"}
          </button>
        </div>
      ))}
      <label className="block text-sm font-bold">Example sentence
        <textarea value={draft.exampleSentence} onChange={e => edit("exampleSentence", e.target.value)} disabled={saving}
          className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
      </label>
      <label className="block text-sm text-ink/70">Optional context for AI
        <input value={guidance} onChange={e => { invalidate(); setGuidance(e.target.value); }} disabled={saving}
          placeholder="For example: here 行 means to be OK"
          className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
      </label>
      {suggestion && (
        <div className="rounded-xl border border-ink/20 bg-white p-3 space-y-2" role="status">
          <p className="text-sm font-bold">AI suggestion — check before using</p>
          <p>{suggestion.value}</p>
          <button type="button" onClick={() => edit(suggestion.field, suggestion.value)} className="rounded-lg bg-ink px-3 py-2 font-bold text-cream">Use suggestion</button>
          <button type="button" onClick={() => setSuggestion(null)} className="ml-2 px-3 py-2 text-sm">Dismiss</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-beak">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => void save()} disabled={saving || asking !== null}
          className="rounded-xl bg-beak px-4 py-2 font-bold text-cream disabled:opacity-40">{saving ? "Saving…" : "Save changes"}</button>
        <button onClick={() => { invalidate(); onCancel(); }} disabled={saving} className="px-3 py-2">Cancel</button>
      </div>
    </div>
  );
}
