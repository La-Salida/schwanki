import { SUPPORT_EMAIL } from "@/lib/legal";

/** Privacy, terms and support, for footers and account pages. Plain links so they work signed out. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal and support" className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      <a href="/privacy" className="underline">Privacy</a>
      <a href="/terms" className="underline">Terms</a>
      <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
    </nav>
  );
}
