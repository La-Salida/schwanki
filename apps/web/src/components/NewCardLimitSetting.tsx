import { useId, useState } from "react";
import { DEFAULT_NEW_LIMIT, useNewLimit } from "@/lib/newCardLimit";

/** Anki's "new cards per day": how many words you meet for the first time each day. */
export function NewCardLimitSetting() {
  const { limit, update } = useNewLimit();
  const [draft, setDraft] = useState(String(limit));
  const [saved, setSaved] = useState<boolean | null>(null);
  const title = useId();
  const n = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 9999;

  return (
    <section aria-labelledby={title} className="space-y-3">
      <h2 id={title} className="text-2xl font-black">New words per day</h2>
      <p className="text-sm text-ink/70">How many words you see for the first time each day, across all decks. Words you've already started keep coming back on schedule. A new day starts at 4am.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (valid) setSaved(update(n)); }}>
        <label className="text-sm font-bold">New words per day
          <input type="number" inputMode="numeric" min={0} max={9999} step={1} value={draft} aria-invalid={!valid}
            onChange={(e) => { setDraft(e.target.value); setSaved(null); }} className="review-display-input mt-2 w-32" />
        </label>
        <button type="submit" className="secondary-button" disabled={!valid || n === limit}>Save</button>
        {limit !== DEFAULT_NEW_LIMIT && <button type="button" className="text-sm font-bold underline" onClick={() => { setDraft(String(DEFAULT_NEW_LIMIT)); setSaved(update(DEFAULT_NEW_LIMIT)); }}>Reset to {DEFAULT_NEW_LIMIT}</button>}
      </form>
      {!valid && <p className="text-sm font-bold text-beak">Enter a whole number from 0 to 9999.</p>}
      {saved !== null && <p role="status" className="text-sm font-bold">{saved ? "Saved on this device." : "Applied for now. This browser couldn’t save it."}</p>}
    </section>
  );
}
