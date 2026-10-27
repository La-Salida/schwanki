/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { headHtml, PAGES, type PageMeta } from "./src/lib/seo.ts";

const SEO_BLOCK = /<!-- seo:[^>]*-->[\s\S]*?<!-- \/seo -->/;
const withSeo = (html: string, page: PageMeta) => {
  if (!SEO_BLOCK.test(html)) throw new Error("index.html lost its <!-- seo --> block");
  return html.replace(SEO_BLOCK, `<!-- seo: from src/lib/seo.ts -->\n    ${headHtml(page)}\n    <!-- /seo -->`);
};

// Home tags go into index.html (which is also the SPA shell). Each other public page gets its
// own copy as <path>.html, so crawlers and link previews see that page's tags without running
// JavaScript; Workers static assets serve /anki-alternative from anki-alternative.html.
function seoPages(): Plugin {
  return {
    name: "schwanki-seo",
    transformIndexHtml: { order: "post", handler: (html) => withSeo(html, PAGES.home) },
    writeBundle({ dir }) {
      if (!dir) return;
      const shell = readFileSync(path.join(dir, "index.html"), "utf8");
      for (const page of Object.values(PAGES)) {
        if (page.path === "/") continue;
        const file = path.join(dir, `${page.path.slice(1)}.html`);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, withSeo(shell, page));
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    seoPages(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      manifest: false, // using public/manifest.webmanifest
      // Images too, so the goose and icons show when the installed app opens offline.
      injectManifest: { globPatterns: ["**/*.{js,css,html,png,webmanifest}"] },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
