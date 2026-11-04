import { expect, test } from "vitest";
import { PAGES } from "@/lib/seo";
import { COMPARISONS } from "@/lib/comparisons";
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

test.each(COMPARISONS)("serves the $name comparison, its answers and sources without JavaScript", (comparison) => {
  const html = renderPage(comparison.path);
  expect(html).toContain(comparison.answer);
  expect(html).toContain("<table");
  for (const { question } of comparison.questions) expect(html).toContain(question);
  for (const { url } of comparison.sources) expect(html).toContain(`href="${url}"`);
  for (const { path } of COMPARISONS.filter(({ path }) => path !== comparison.path)) {
    expect(html).toContain(`href="${path}"`);
  }
});
