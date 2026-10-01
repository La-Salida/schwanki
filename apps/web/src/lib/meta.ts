import type { SourceType } from "@schwanki/core";

/** Platform icon per source type (the app's playful emoji register). */
export const SOURCE_ICON: Record<SourceType, string> = {
  google_sheet: "📊",
  google_doc: "📄",
  pdf_upload: "📕",
  preply_chat: "💬",
  manual: "✍️",
};

export const SOURCE_LABEL: Record<SourceType, string> = {
  google_sheet: "Google Sheet",
  google_doc: "Google Doc",
  pdf_upload: "PDF upload",
  preply_chat: "Preply chat",
  manual: "manual",
};

const FLAGS: Record<string, string> = {
  zh: "🇨🇳", "zh-cn": "🇨🇳", "zh-tw": "🇹🇼", "zh-hans": "🇨🇳", "zh-hant": "🇹🇼",
  ko: "🇰🇷", ja: "🇯🇵", en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪",
  pt: "🇧🇷", vi: "🇻🇳", ru: "🇷🇺", it: "🇮🇹", th: "🇹🇭", ar: "🇸🇦", hi: "🇮🇳",
};

export function flagFor(language: string): string {
  return FLAGS[language.toLowerCase()] ?? "🌐";
}

/** Compact relative time: "3m ago", "2h ago", "5d ago" (fallback to the ISO date). */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const minutes = Math.max(0, Math.floor((now - t) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return iso.slice(0, 10);
}
