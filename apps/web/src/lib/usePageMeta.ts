import { useEffect } from "react";
import { canonicalUrl, JSON_LD_ID, metaEntries, PAGES, type PageMeta } from "./seo";

function applyPageMeta(page: PageMeta) {
  document.title = page.title;
  for (const { attr, key, content } of metaEntries(page)) {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.content = content;
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl(page);
  let jsonLd = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
  if (!jsonLd) {
    jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    jsonLd.id = JSON_LD_ID;
    document.head.appendChild(jsonLd);
  }
  jsonLd.text = JSON.stringify(page.structuredData());
}

/** Keeps the head in step with a public page during client-side navigation; back to the home tags on leave. */
export function usePageMeta(page: PageMeta) {
  useEffect(() => {
    applyPageMeta(page);
    return () => applyPageMeta(PAGES.home);
  }, [page]);
}
