// Build-time HTML for the public pages, so crawlers that don't run JavaScript (most AI
// answer engines) see the page text, not an empty #root. vite.config.ts loads this through
// Vite's SSR loader and writes the result into each page's .html file.
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import AnkiAlternative from "@/pages/AnkiAlternative";
import AnkiMobileComparison from "@/pages/AnkiMobileComparison";
import ExportAnkiGuide from "@/pages/ExportAnkiGuide";
import Pricing from "@/pages/Pricing";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import { PAGES } from "@/lib/seo";

// Home is left out on purpose: index.html is also the installed app's shell, and signed-in
// users would see the landing page flash before their review feed.
const PRERENDERED: Record<string, ComponentType> = {
  [PAGES.ankiAlternative.path]: AnkiAlternative,
  [PAGES.ankiMobileComparison.path]: AnkiMobileComparison,
  [PAGES.exportAnkiGuide.path]: ExportAnkiGuide,
  [PAGES.pricing.path]: () => <Pricing signedIn={false} />,
  [PAGES.privacy.path]: Privacy,
  [PAGES.terms.path]: Terms,
};

export const prerenderedPaths = Object.keys(PRERENDERED);

export function renderPage(path: string): string {
  const Page = PRERENDERED[path];
  if (!Page) throw new Error(`No prerendered component for ${path}`);
  return renderToString(<StaticRouter location={path}><Page /></StaticRouter>);
}
