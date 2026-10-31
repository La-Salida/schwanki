import type { ReactNode } from "react";
import type { PageMeta } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";
import { LEGAL_UPDATED } from "@/lib/legal";
import { LegalLinks } from "./LegalLinks";

export function LegalPage({ page, heading, children }: { page: PageMeta; heading: string; children: ReactNode }) {
  usePageMeta(page);
  return (
    <main id="main-content" className="page-shell">
      <article className="legal-page mx-auto max-w-2xl space-y-6 py-8">
        <nav aria-label="Breadcrumb" className="text-sm text-ink/60"><a href="/" className="hover:text-ink">Schwanki</a> › <span className="text-ink">{heading}</span></nav>
        <header className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight">{heading}</h1>
          <p className="text-sm text-ink/60">Last updated {LEGAL_UPDATED}</p>
        </header>
        {children}
        <footer className="border-t border-ink/20 pt-6 text-sm text-ink/70 space-y-2"><a href="/anki-alternative" className="underline">Anki alternative</a><LegalLinks /></footer>
      </article>
    </main>
  );
}
