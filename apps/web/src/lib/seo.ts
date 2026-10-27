// Per-route titles, descriptions, social cards and JSON-LD. One source for three consumers:
// index.html at build and dev time, the static copies of public pages written at build
// time (vite.config.ts), and usePageMeta when the app navigates client-side.
import { ankiAlternativeStructuredData, exportGuideStructuredData, homeStructuredData } from "./structuredData.ts";

export const SITE_URL = "https://schwankiapp.com";

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  ogType: "website" | "article";
  /** 1200×630 social card, served from public/og/. */
  image: string;
  imageAlt: string;
  structuredData: () => object;
}

export const PAGES = {
  home: {
    path: "/",
    title: "Schwanki · A modern take on Anki with a swipe feed",
    description: "Spaced repetition that scrolls like a feed and ends. Import Anki decks with their review history, or build decks from your class notes. Free to start.",
    ogType: "website",
    image: "/og/home.jpg",
    imageAlt: "Schwanki: a modern take on Anki. The Chaos Goose runs off with a vocab notebook.",
    structuredData: homeStructuredData,
  },
  ankiAlternative: {
    path: "/anki-alternative",
    title: "Anki Alternative for Language Learners | Schwanki",
    description: "Switch from Anki without starting over. Import .apkg/.colpkg with review history and FSRS v5 scheduling, then review in a swipeable mobile feed.",
    ogType: "article",
    image: "/og/anki-alternative.jpg",
    imageAlt: "Keep your decks. Lose the grind. Schwanki, the Anki alternative for language learners.",
    structuredData: ankiAlternativeStructuredData,
  },
  exportAnkiGuide: {
    path: "/guides/export-anki-with-scheduling",
    title: "Export Anki Decks Without Losing Progress (2026 Guide)",
    description: "Progress reset after an .apkg import? Tick \"Include scheduling information\" in Anki's export. Step-by-step for Desktop, AnkiMobile & AnkiDroid.",
    ogType: "article",
    image: "/og/export-anki-guide.jpg",
    imageAlt: "Guide: export Anki decks without losing progress.",
    structuredData: exportGuideStructuredData,
  },
} satisfies Record<string, PageMeta>;

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const canonicalUrl = (page: PageMeta) => SITE_URL + page.path;

/** Head tags managed per page, keyed so the client can find and update each one. */
export function metaEntries(page: PageMeta): Array<{ attr: "name" | "property"; key: string; content: string }> {
  const image = SITE_URL + page.image;
  return [
    { attr: "name", key: "description", content: page.description },
    { attr: "property", key: "og:site_name", content: "Schwanki" },
    { attr: "property", key: "og:locale", content: "en_US" },
    { attr: "property", key: "og:type", content: page.ogType },
    { attr: "property", key: "og:url", content: canonicalUrl(page) },
    { attr: "property", key: "og:title", content: page.title },
    { attr: "property", key: "og:description", content: page.description },
    { attr: "property", key: "og:image", content: image },
    { attr: "property", key: "og:image:type", content: "image/jpeg" },
    { attr: "property", key: "og:image:width", content: "1200" },
    { attr: "property", key: "og:image:height", content: "630" },
    { attr: "property", key: "og:image:alt", content: page.imageAlt },
    { attr: "name", key: "twitter:card", content: "summary_large_image" },
    { attr: "name", key: "twitter:title", content: page.title },
    { attr: "name", key: "twitter:description", content: page.description },
    { attr: "name", key: "twitter:image", content: image },
    { attr: "name", key: "twitter:image:alt", content: page.imageAlt },
  ];
}

export const JSON_LD_ID = "seo-jsonld";

/** The page's <head> tags as HTML, for index.html and the static copies of public pages. */
export function headHtml(page: PageMeta): string {
  // "<" inside JSON-LD would let a string close the script tag early.
  const jsonLd = JSON.stringify(page.structuredData()).replace(/</g, "\\u003c");
  return [
    `<title>${escape(page.title)}</title>`,
    `<link rel="canonical" href="${canonicalUrl(page)}" />`,
    ...metaEntries(page).map(({ attr, key, content }) => `<meta ${attr}="${key}" content="${escape(content)}" />`),
    `<script type="application/ld+json" id="${JSON_LD_ID}">${jsonLd}</script>`,
  ].join("\n    ");
}
