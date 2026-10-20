import { useId, useState } from "react";

type Platform = "computer" | "iphone" | "android" | "web";

const platforms: { id: Platform; label: string }[] = [
  { id: "computer", label: "Computer" },
  { id: "iphone", label: "iPhone / iPad" },
  { id: "android", label: "Android" },
  { id: "web", label: "AnkiWeb" },
];

function currentPlatform(): Platform {
  if (typeof navigator === "undefined") return "computer";
  if (/Android/i.test(navigator.userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iphone";
  return "computer";
}

const guides: Record<Platform, { title: string; steps: string[]; help: string }> = {
  computer: {
    title: "Export from Anki on your computer",
    steps: [
      "Open Anki on your computer. If you use AnkiWeb, sync first to include your latest reviews.",
      "Choose File → Export. Select your deck and Anki Deck Package (.apkg).",
      "Turn on Include scheduling information and Include media, then export the file.",
      "Return here and choose the exported file below. You’ll preview the cards before importing.",
    ],
    help: "https://docs.ankiweb.net/exporting.html#deck-apkg",
  },
  iphone: {
    title: "Export from AnkiMobile on your iPhone or iPad",
    steps: [
      "Open AnkiMobile. On the deck list, tap Add/Export at the bottom.",
      "Choose Export/Share to export your collection. Keep media included.",
      "Save the exported file to Files using the share sheet.",
      "Return here and choose that file below. You can select which decks to import in the preview.",
    ],
    help: "https://docs.ankimobile.net/collection-transfer.html",
  },
  android: {
    title: "Export from AnkiDroid on your Android phone",
    steps: [
      "Open AnkiDroid. If you use AnkiWeb, sync first to include your latest reviews.",
      "Press and hold the deck you want, then tap Export.",
      "Turn on Include scheduling information and Include media. Export and save the .apkg file on your phone.",
      "Return here and choose that file below. You’ll preview the cards before importing.",
    ],
    help: "https://docs.ankidroid.org/#exporting",
  },
  web: {
    title: "Bring decks from your AnkiWeb account",
    steps: [
      "Install or open Anki on a computer and sign in to the same AnkiWeb account when you sync.",
      "Finish syncing, including media, so your decks and latest reviews are on that computer.",
      "Choose File → Export, select Anki Deck Package (.apkg), and include scheduling information and media.",
      "Save the export, then choose it below. AnkiMobile and AnkiDroid can also export files; select your device above for those steps.",
    ],
    help: "https://docs.ankiweb.net/syncing.html",
  },
};

export function AnkiExportGuide() {
  const groupId = useId();
  const headingId = useId();
  const [platform, setPlatform] = useState<Platform>(currentPlatform);
  const guide = guides[platform];
  return (
    <div className="anki-export-guide">
      <fieldset>
        <legend className="text-sm font-bold">Where do you use Anki?</legend>
        <div className="anki-export-platforms">
          {platforms.map((option) => (
            <label key={option.id} className="anki-export-choice" data-selected={platform === option.id}>
              <input type="radio" name={groupId} value={option.id} checked={platform === option.id}
                onChange={() => setPlatform(option.id)} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <section aria-labelledby={headingId} className="anki-export-instructions">
        <h3 id={headingId} className="font-bold">{guide.title}</h3>
        {platform === "web" && <p className="text-sm text-ink/70">Direct AnkiWeb account import isn’t available. Use an export from one of the Anki apps; your Anki password isn’t needed here.</p>}
        {platform === "web" && <a href="https://apps.ankiweb.net/" target="_blank" rel="noreferrer" className="text-sm font-bold underline">Get Anki for your computer ↗</a>}
        <ol>
          {guide.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <a href={guide.help} target="_blank" rel="noreferrer" className="text-xs font-bold underline">Official Anki instructions ↗</a>
      </section>
    </div>
  );
}
