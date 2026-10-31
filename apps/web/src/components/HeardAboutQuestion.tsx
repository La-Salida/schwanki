import { useState } from "react";
import { useAccount } from "@/lib/account";
import { HEARD_ABOUT, saveHeardAbout, type HeardAbout } from "@/lib/attribution";
import { setUserProperty, track } from "@/lib/analytics";

/** Optional one-tap question for new accounts. Never blocks setup. */
export function HeardAboutQuestion() {
  const { user } = useAccount();
  const [state, setState] = useState<"ask" | "saving" | "done" | "failed">("ask");

  async function answer(choice: HeardAbout) {
    setState("saving");
    try {
      await saveHeardAbout(user.id, choice);
      track({ name: "Heard About Answered", props: { answer: choice } });
      setUserProperty("heard_about", choice);
      setState("done");
    }
    catch { setState("failed"); }
  }

  if (state === "done") return <p className="text-sm text-ink/60" role="status">Thanks, that helps.</p>;

  return (
    <fieldset className="space-y-2 border-t border-ink/10 pt-4" disabled={state === "saving"}>
      <legend className="text-sm font-bold">How did you hear about Schwanki? <span className="font-normal text-ink/60">Optional</span></legend>
      <div className="flex flex-wrap gap-2">
        {HEARD_ABOUT.map(([value, label]) => (
          <button key={value} type="button" className="secondary-button px-3 py-1.5 text-sm" onClick={() => void answer(value)}>{label}</button>
        ))}
      </div>
      {state === "failed" && <p role="alert" className="text-sm text-ink/60">Couldn't save that. Tap again to retry.</p>}
    </fieldset>
  );
}
