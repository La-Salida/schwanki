import { useEffect, useRef, useState } from "react";
import type { CardEdits, CardHelpField } from "@schwanki/core";
import { supabase } from "@/lib/supabase";
import { loadCardMedia, type LoadedMedia } from "@/lib/mnemonic";
import { validateCardFile, type ManualMediaEdits } from "@/lib/manualMedia";

export function CardEditor({ id, kind, initial, onSave, onCancel }: {
  id: string; kind: "candidate" | "card"; initial: CardEdits;
  onSave: (edits: CardEdits, media?: ManualMediaEdits) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [guidance, setGuidance] = useState("");
  const [suggestion, setSuggestion] = useState<{ field: CardHelpField; value: string } | null>(null);
  const [asking, setAsking] = useState<CardHelpField | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [scene, setScene] = useState({ text: "", translation: "" });
  const [files, setFiles] = useState<Pick<ManualMediaEdits, "image" | "audio">>({});
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  useEffect(() => {
    if (kind !== "card") return;
    let live = true;
    void loadCardMedia(id).then(value => {
      if (live) { setMedia(value); setScene(value.sentence ?? { text: "", translation: "" }); }
    }).catch(() => { if (live) setMediaError(true); });
    return () => { live = false; };
  }, [id, kind]);

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
    try {
      const edits = { front: draft.front.trim(), back: draft.back.trim(), reading: draft.reading.trim(), exampleSentence: draft.exampleSentence.trim() };
      const mediaEdits: ManualMediaEdits = { ...files };
      if (media && (scene.text !== (media.sentence?.text ?? "") || scene.translation !== (media.sentence?.translation ?? ""))) {
        mediaEdits.example = { text: scene.text.trim(), translation: scene.translation.trim() };
      }
      if (Object.keys(mediaEdits).length) await onSave(edits, mediaEdits);
      else await onSave(edits);
    }
    catch (failure) { setError((failure as Error).message); setSaving(false); }
  }

  function chooseFile(kind: "image" | "audio", file?: File) {
    if (!file) return;
    try { validateCardFile(kind, file); setFiles(current => ({ ...current, [kind]: file })); setError(null); }
    catch (failure) { setError((failure as Error).message); }
  }

  return (
    <div className="space-y-3 rounded-xl border border-ink/15 bg-paper p-4" role="group" aria-label="Edit vocabulary card">
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
      {kind === "card" && <p className="text-xs text-ink/60">Original card example, kept for reference. When a review sentence exists below, that is the single example shown during review. You can correct or clear either one.</p>}
      {kind === "card" && <fieldset disabled={saving} className="space-y-3 border-t border-ink/15 pt-4">
        <legend className="px-1 font-bold">Review sentence and media</legend>
        <p className="text-sm text-ink/70">Edit everything here manually. No AI or credits required.</p>
        {mediaError ? <p role="status" className="text-sm text-margin">Couldn’t load the scene. Close and reopen the editor to retry. Your card text can still be saved.</p> : !media ? <p role="status" className="text-sm">Loading scene…</p> : <>
          <label className="block text-sm font-bold">Review sentence
            <textarea value={scene.text} onChange={e => setScene(current => ({ ...current, text: e.target.value }))} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
          </label>
          <label className="block text-sm font-bold">Sentence translation
            <textarea value={scene.translation} onChange={e => setScene(current => ({ ...current, translation: e.target.value }))} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
          </label>
          {scene.text.trim() !== (media.sentence?.text ?? "").trim() && <p className="text-sm text-ink/70">Changing the review sentence clears its old picture and recording. Select replacements below, or generate new ones after saving.</p>}
          {(["image", "audio"] as const).map(kind => <div key={kind} className="space-y-2 rounded-lg border border-ink/15 p-3">
            <p className="text-sm font-bold">{kind === "image" ? "Scene image" : "Sentence recording"}</p>
            {files[kind] === undefined && (kind === "image" ? media.imageUrl && <img src={media.imageUrl} alt="Current scene" className="max-h-40 rounded-lg" /> : media.audioUrl && <audio src={media.audioUrl} controls preload="none" className="max-w-full" />)}
            <label className="block text-sm">{kind === "image" ? "Replace image" : "Replace recording"}
              <input type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "audio/*"} onChange={e => chooseFile(kind, e.target.files?.[0])} className="mt-1 block w-full text-sm" />
            </label>
            {files[kind] && <p className="text-xs">Ready to save: {files[kind]!.name}</p>}
            {files[kind] === null && <p className="text-xs">Will be removed when you save.</p>}
            {(files[kind] || (kind === "image" ? media.imageUrl : media.audioUrl)) && <button type="button" onClick={() => setFiles(current => ({ ...current, [kind]: null }))} className="text-sm font-bold underline">{kind === "image" ? "Remove image" : "Remove recording"}</button>}
            {files[kind] !== undefined && <button type="button" onClick={() => setFiles(current => { const next = { ...current }; delete next[kind]; return next; })} className="ml-3 text-sm underline">Undo media change</button>}
          </div>)}
        </>}
      </fieldset>}
      <label className="block text-sm text-ink/70">Optional context for AI
        <input value={guidance} onChange={e => { invalidate(); setGuidance(e.target.value); }} disabled={saving}
          placeholder="For example: here 行 means to be OK"
          className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
      </label>
      {suggestion && (
        <div className="rounded-xl border border-ink/20 bg-white p-3 space-y-2" role="status">
          <p className="text-sm font-bold">AI suggestion. Check before using.</p>
          <p>{suggestion.value}</p>
          <button type="button" onClick={() => edit(suggestion.field, suggestion.value)} className="rounded-lg bg-ink px-3 py-2 font-bold text-paper">Use suggestion</button>
          <button type="button" onClick={() => setSuggestion(null)} className="ml-2 px-3 py-2 text-sm">Dismiss</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-margin">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => void save()} disabled={saving || asking !== null}
          className="rounded-xl bg-ruled px-4 py-2 font-bold text-paper disabled:opacity-40">{saving ? "Saving…" : "Save changes"}</button>
        <button onClick={() => { invalidate(); onCancel(); }} disabled={saving} className="px-3 py-2">Cancel</button>
      </div>
    </div>
  );
}
