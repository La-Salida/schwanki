/// <reference types="vitest/config" />
import { createServer, defineConfig, type Plugin } from "vite";
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

const EMPTY_ROOT = '<div id="root"></div>';
const withBody = (html: string, body: string) => {
  if (!html.includes(EMPTY_ROOT)) throw new Error("index.html lost its empty #root");
  return html.replace(EMPTY_ROOT, `<div id="root">${body}</div>`);
};

// Modules that touch window or create the Supabase client on import. The public pages only
// call them from click handlers, so the prerender gets inert stand-ins.
const BROWSER_ONLY: Record<string, string> = {
  [path.resolve(__dirname, "src/lib/supabase.ts")]: "export const supabase = {}; export const api = {};",
  [path.resolve(__dirname, "src/lib/auth.ts")]: "export async function signInWithGoogle() {}",
};
function stubBrowserOnlyModules(): Plugin {
  return {
    name: "schwanki-prerender-stubs",
    enforce: "pre",
    async resolveId(source, importer) {
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      return resolved && BROWSER_ONLY[resolved.id] !== undefined ? `\0stub:${resolved.id}` : null;
    },
    load(id) {
      return id.startsWith("\0stub:") ? BROWSER_ONLY[id.slice("\0stub:".length)] : null;
    },
  };
}

/** Renders the public pages' React components to HTML with Vite's SSR loader. */
async function renderPublicPages(mode: string): Promise<Map<string, string>> {
  const server = await createServer({
    configFile: false,
    root: __dirname,
    mode,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    optimizeDeps: { noDiscovery: true },
    plugins: [stubBrowserOnlyModules()],
  });
  try {
    const { prerenderedPaths, renderPage } = await server.ssrLoadModule("/src/prerender.tsx");
    return new Map((prerenderedPaths as string[]).map((p) => [p, (renderPage as (p: string) => string)(p)]));
  } finally {
    await server.close();
  }
}

// Home tags go into index.html (which is also the SPA shell). Each other public page gets its
// own copy as <path>.html with its tags and its rendered body, so crawlers and link previews
// see the page without running JavaScript; Workers static assets serve /anki-alternative from
// anki-alternative.html.
function seoPages(): Plugin {
  let mode = "production";
  return {
    name: "schwanki-seo",
    configResolved(config) { mode = config.mode; },
    transformIndexHtml: { order: "post", handler: (html) => withSeo(html, PAGES.home) },
    async writeBundle({ dir }) {
      if (!dir) return;
      const shell = readFileSync(path.join(dir, "index.html"), "utf8");
      const bodies = await renderPublicPages(mode);
      for (const page of Object.values(PAGES)) {
        if (page.path === "/") continue;
        const body = bodies.get(page.path);
        if (!body) throw new Error(`${page.path} is a public page but src/prerender.tsx doesn't render it`);
        const file = path.join(dir, `${page.path.slice(1)}.html`);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, withBody(withSeo(shell, page), body));
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
