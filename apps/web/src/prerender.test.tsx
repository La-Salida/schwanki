import { expect, test } from "vitest";
import { PAGES } from "@/lib/seo";
import { prerenderedPaths, renderPage } from "./prerender";

test("every public page except home is prerendered with its content", () => {
  const publicPaths = Object.values(PAGES).map((p) => p.path).filter((p) => p !== "/");
  expect([...prerenderedPaths].sort()).toEqual([...publicPaths].sort());
  for (const path of prerenderedPaths) expect(renderPage(path)).toMatch(/<h1[^>]*>.+<\/h1>/);
});

test("the Anki alternative page is linked from the other prerendered pages' footers", () => {
  for (const path of [PAGES.pricing.path, PAGES.privacy.path, PAGES.terms.path]) {
    expect(renderPage(path)).toContain('href="/anki-alternative"');
  }
});
