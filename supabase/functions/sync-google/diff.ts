export function extractGoogleFileId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? null;
}

/**
 * Append-mostly diff (§3/§6.3): teachers add lines after each lesson.
 * Set-difference of normalized lines; order of new lines preserved.
 */
export function addedLines(oldContent: string | null, newContent: string): string[] {
  const norm = (s: string) =>
    s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const oldSet = new Set(oldContent ? norm(oldContent) : []);
  return norm(newContent).filter((l) => !oldSet.has(l));
}
