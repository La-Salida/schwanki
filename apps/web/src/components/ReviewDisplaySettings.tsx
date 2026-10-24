import { useId, useState } from "react";
import { DEFAULT_REVIEW_DISPLAY, DISPLAY_FIELDS, REVIEW_PRESETS, useReviewDisplay, type DisplayField, type DisplaySide } from "@/lib/reviewDisplay";

const LABELS: Record<DisplayField, string> = {
  word: "Word", reading: "Pronunciation / reading", meaning: "Meaning", sentence: "Example sentence",
  translation: "Sentence translation", image: "Helper image", audio: "Audio",
};

export function ReviewDisplaySettings() {
  const { display, update } = useReviewDisplay();
  const [saved, setSaved] = useState<boolean | null>(null);
  const title = useId();
  const preset = REVIEW_PRESETS.find(p => DISPLAY_FIELDS.every(field => p.display.fields[field] === display.fields[field]))?.id ?? "custom";

  return (
    <section aria-labelledby={title} className="review-display-settings space-y-5">
      <div>
        <h2 id={title} className="text-2xl font-black">Review display</h2>
        <p className="mt-2 text-sm text-ink/70">Choose your cue, then reveal the rest. These choices apply to phone and desktop reviews on this device.</p>
      </div>
      <label className="block text-sm font-bold">Start with
        <select className="review-display-input mt-2" value={preset} onChange={e => {
          const next = REVIEW_PRESETS.find(p => p.id === e.target.value);
          if (next) setSaved(update(next.display));
        }}>
          {REVIEW_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          <option value="custom" disabled>Custom combination</option>
        </select>
      </label>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-bold">Or choose each part</legend>
        {DISPLAY_FIELDS.map(field => (
          <label key={field} className="review-display-row">
            <span>{LABELS[field]}</span>
            <select className="review-display-input" value={display.fields[field]} onChange={e => setSaved(update({
              ...display, fields: { ...display.fields, [field]: e.target.value as DisplaySide },
            }))}>
              <option value="both">Both sides</option>
              <option value="prompt">Before reveal</option>
              <option value="answer">After reveal</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
        ))}
      </fieldset>
      <label className="flex items-start gap-3 text-sm font-bold">
        <input type="checkbox" className="mt-1" checked={display.autoplay} onChange={e => setSaved(update({ ...display, autoplay: e.target.checked }))} />
        <span>Play audio automatically when it appears<span className="mt-1 block font-normal text-ink/70">You can always replay it. Muting the feed pauses autoplay.</span></span>
      </label>
      <p className="text-sm text-ink/70">Missing pictures or audio won’t expose a hidden answer. You can reveal or change these choices.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="secondary-button" onClick={() => setSaved(update(DEFAULT_REVIEW_DISPLAY))}>Reset display</button>
        {saved !== null && <p role="status" className="text-sm font-bold">{saved ? "Saved on this device." : "Applied for now. This browser couldn’t save your choices."}</p>}
      </div>
    </section>
  );
}
