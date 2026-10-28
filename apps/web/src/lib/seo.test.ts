import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CREDIT_PACKS, STARTER_CREDITS } from "@schwanki/mnemonic";
import { headHtml, PAGES, SITE_URL } from "./seo";
import { SEO_CREDIT_PACKS, SEO_STARTER_CREDITS } from "./structuredData";

const publicFile = (name: string) => readFileSync(path.join(__dirname, "../../public", name), "utf8");

describe("page metadata", () => {
  it("lists every public page in the sitemap, and nothing else", () => {
    const sitemap = [...publicFile("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    expect(sitemap).toEqual(Object.values(PAGES).map((p) => SITE_URL + p.path).sort());
  });

  it("keeps titles and descriptions inside what search results show", () => {
    for (const page of Object.values(PAGES)) {
      expect(page.title.length, page.title).toBeLessThanOrEqual(65);
      expect(page.description.length, page.description).toBeLessThanOrEqual(160);
    }
  });

  it("points every social card at an image that ships", () => {
    for (const page of Object.values(PAGES)) {
      expect(() => readFileSync(path.join(__dirname, "../../public", page.image))).not.toThrow();
    }
  });

  it("escapes quotes in attributes and keeps JSON-LD from closing its script tag", () => {
    const html = headHtml({ ...PAGES.home, description: 'Say "hi" <b>', structuredData: () => ({ name: "</script>" }) });
    expect(html).toContain('content="Say &quot;hi&quot; &lt;b&gt;"');
    expect(html).not.toContain('"</script>"');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it("prices the pricing page's JSON-LD from the real credit packs", () => {
    expect(SEO_STARTER_CREDITS).toBe(STARTER_CREDITS);
    expect(SEO_CREDIT_PACKS).toEqual(CREDIT_PACKS.map((p) => ({ name: p.label, credits: p.credits, price: String(p.priceCents / 100) })));
  });
});
