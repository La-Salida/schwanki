import { useState } from "react";
import { flagFor } from "@/lib/meta";

function initials(name: string): string {
  const words = name.replace(/^(ms|mr|mrs|dr|kru|teacher|prof)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? name).slice(0, 2)).toUpperCase();
}

/** The teacher's Preply photo, or their initials until a profile is linked. */
export function TeacherAvatar({ name, photoUrl, language, size = "md" }: {
  name: string; photoUrl?: string | undefined; language?: string; size?: "md" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  const box = size === "lg" ? "h-16 w-16 text-xl" : "h-12 w-12 text-base";
  return (
    <span className={`relative inline-flex shrink-0 ${box}`}>
      {photoUrl && !broken ? (
        <img src={photoUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)}
          className="h-full w-full rounded-full border border-ink/20 object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-full w-full items-center justify-center rounded-full border border-ink/20 bg-ink/10 font-black text-ink/70">
          {initials(name)}
        </span>
      )}
      {language && (
        <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-ink/20 bg-cream text-sm">
          {flagFor(language)}
        </span>
      )}
    </span>
  );
}

