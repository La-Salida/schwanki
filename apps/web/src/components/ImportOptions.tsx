import type { ReactNode } from "react";

/** Generic file-type marks in each source's colour, not the products' logos. */
const SOURCES: { label: string; icon: ReactNode }[] = [
  { label: "Anki deck", icon: <svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" rx="3" fill="#FAF6EF" /><path d="M16 10.5l1.9 3.9 4.3.6-3.1 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3.1-3 4.3-.6z" fill="#2346B8" /></svg> },
  { label: "Google Sheets", icon: <svg viewBox="0 0 32 32"><rect x="6" y="3" width="20" height="26" rx="3" fill="#1E8E3E" /><path d="M10 12h12v10H10zM10 17h12M16 12v10" stroke="#fff" strokeWidth="1.6" fill="none" /></svg> },
  { label: "Google Docs", icon: <svg viewBox="0 0 32 32"><rect x="6" y="3" width="20" height="26" rx="3" fill="#2F6FDE" /><path d="M10 11h12M10 15h12M10 19h12M10 23h7" stroke="#fff" strokeWidth="1.8" /></svg> },
  { label: "PDF", icon: <svg viewBox="0 0 32 32"><rect x="6" y="3" width="20" height="26" rx="3" fill="#D93025" /><text x="16" y="20" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="Archivo, sans-serif">PDF</text></svg> },
  { label: "Canva", icon: <svg viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="7" fill="#12A3B8" /><circle cx="12" cy="13" r="4" fill="#fff" /><path d="M8 24l6-6 4 4 3-3 4 5z" fill="#fff" /></svg> },
  { label: "PowerPoint", icon: <svg viewBox="0 0 32 32"><rect x="3" y="6" width="26" height="20" rx="3" fill="#D24726" /><rect x="7" y="10" width="11" height="8" rx="1" fill="#fff" /><path d="M20 11h5M20 15h5M7 22h18" stroke="#fff" strokeWidth="1.8" /></svg> },
  { label: "Screenshots of your notes", icon: <svg viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="19" rx="3" fill="#8E6BD8" /><path d="M11 7l2-3h6l2 3" fill="#8E6BD8" /><circle cx="16" cy="16.5" r="5" fill="none" stroke="#fff" strokeWidth="2" /></svg> },
  { label: "Preply lessons", icon: <svg viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="13" fill="#FF4F81" /><path d="M10 12h12v8h-7l-4 3v-3h-1z" fill="#fff" /></svg> },
];

/** Everything a learner can bring in, each tile starting sign-in. */
export function ImportOptions({ onPick }: { onPick?: (() => void) | undefined }) {
  return (
    <ul className="import-options" aria-label="What you can import">
      {SOURCES.map(({ label, icon }) => (
        <li key={label}>
          {onPick
            ? <button type="button" onClick={onPick}><span aria-hidden="true">{icon}</span>{label}</button>
            : <a href="#connect"><span aria-hidden="true">{icon}</span>{label}</a>}
        </li>
      ))}
    </ul>
  );
}
