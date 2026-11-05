// Per-route titles, descriptions, social cards and JSON-LD. One source for three consumers:
// index.html at build and dev time, the static copies of public pages written at build
// time (vite.config.ts), and usePageMeta when the app navigates client-side.
import { ankiAlternativeStructuredData, ankiMobileComparisonStructuredData, exportGuideStructuredData, homeStructuredData, pricingStructuredData } from "./structuredData.ts";
import { COMPARISONS, COMPARISON_DATE, type Comparison } from "./comparisons.ts";

export const SITE_URL = "https://schwankiapp.com";
const HOME_IMAGE_ALT = "Schwanki: lesson notes to flashcards. The Chaos Goose carries a vocabulary notebook.";

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

function comparisonMeta(comparison: Comparison): PageMeta {
  const { path, title, description, sources } = comparison;
  const url = SITE_URL + path;
  return {
    path, title, description,
    ogType: "article",
    image: "/og/home.jpg",
    imageAlt: HOME_IMAGE_ALT,
    structuredData: () => ({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      mainEntityOfPage: url,
      datePublished: COMPARISON_DATE,
      dateModified: COMPARISON_DATE,
      author: { "@type": "Organization", name: "Schwanki", url: SITE_URL },
      image: SITE_URL + "/og/home.jpg",
      citation: sources.map(({ url }) => url),
    }),
  };
}

export const COMPARISON_PAGES = Object.fromEntries(
  COMPARISONS.map((comparison) => [comparison.path, comparisonMeta(comparison)]),
);

export const PAGES = {
  ...COMPARISON_PAGES,
  home: {
    path: "/",
    title: "Schwanki | Turn Language Lessons into Flashcards",
    description: "Turn your tutor’s Canva PDF, slides, or notes into flashcards and swipe through your due vocabulary. Bring your Anki decks and review history too.",
    ogType: "website",
    image: "/og/home.jpg",
    imageAlt: HOME_IMAGE_ALT,
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
  ankiMobileComparison: {
    path: "/vs/ankimobile",
    title: "Schwanki vs AnkiMobile (26.10, Nov 2026): Is $24.99 Still Worth It?",
    description: "AnkiMobile 26.10 is on the App Store (Nov 2026) with a redesigned Browse and deck list. Still $24.99 one-time. Here's what changed and when Schwanki or both make sense.",
    ogType: "article",
    image: "/og/anki-alternative.jpg",
    imageAlt: "Schwanki vs AnkiMobile comparison: is the $24.99 still worth it in 2026?",
    structuredData: ankiMobileComparisonStructuredData,
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
  pricing: {
    path: "/pricing",
    title: "Pricing: Free Flashcards, Pay-as-You-Go AI | Schwanki",
    description: "Schwanki is free for decks, reviews and Anki imports. AI pictures and audio cost one credit a card, from 3.3¢. No subscription, or bring your own keys.",
    ogType: "website",
    image: "/og/pricing.jpg",
    imageAlt: "Free gets you the deck. Credits get you the cinema. Schwanki pricing.",
    structuredData: pricingStructuredData,
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy | Schwanki",
    description: "What Schwanki collects, why, which services process it, and how to delete your account and data.",
    ogType: "website",
    image: "/og/home.jpg",
    imageAlt: HOME_IMAGE_ALT,
    structuredData: () => legalPageData("Privacy Policy", "/privacy"),
  },
  terms: {
    path: "/terms",
    title: "Terms of Service | Schwanki",
    description: "The terms for using Schwanki, including your content, AI-generated memory aids, credits and fair use.",
    ogType: "website",
    image: "/og/home.jpg",
    imageAlt: HOME_IMAGE_ALT,
    structuredData: () => legalPageData("Terms of Service", "/terms"),
  },
} satisfies Record<string, PageMeta>;

function legalPageData(name: string, path: string) {
  return { "@context": "https://schema.org", "@type": "WebPage", name, url: SITE_URL + path };
}

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
