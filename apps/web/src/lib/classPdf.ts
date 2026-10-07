/** Recognize the teacher's year-month-day filenames; never substitute today's date. */
export function classDateFromFilename(filename: string): string | null {
  const match = /^(\d{4}|\d{2})[-_](\d{1,2})[-_](\d{1,2})(?=[_.\s-]|$)/.exec(filename);
  if (!match) return null;
  const year = Number(match[1]) + (match[1]!.length === 2 ? 2000 : 0);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function classPdfTeacher(label: string): string {
  return label.replace(/ · \d{4}-\d{2}-\d{2}$/, "");
}
