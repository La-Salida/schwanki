import { classPdfTeacher } from "@/lib/classPdf";

export const LANGUAGE_NAMES: Record<string, string> = {
  zh: "Chinese", th: "Thai", es: "Spanish", fr: "French",
  de: "German", ja: "Japanese", ko: "Korean", en: "English",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/** The class date carried in a PDF label ("Ms. Li · 2026-09-16"), if any. */
export function classDate(label: string): string | null {
  return / · (\d{4}-\d{2}-\d{2})$/.exec(label)?.[1] ?? null;
}

export interface LanguageGroup<T> { language: string; items: T[] }
export interface TeacherGroup<T> { teacher: string; languages: LanguageGroup<T>[]; count: number }

/**
 * Group sources (or anything with a label and language) by teacher, then language.
 * Teachers sort alphabetically; inside a language, dated classes come newest first.
 */
export function groupByTeacher<T extends { label: string; language: string }>(items: T[]): TeacherGroup<T>[] {
  const teachers = new Map<string, Map<string, T[]>>();
  for (const item of items) {
    const teacher = classPdfTeacher(item.label).trim() || item.label;
    const key = teacher.toLowerCase();
    let languages = teachers.get(key);
    if (!languages) { languages = new Map(); teachers.set(key, languages); }
    const list = languages.get(item.language) ?? [];
    list.push(item);
    languages.set(item.language, list);
  }
  return [...teachers.values()]
    .map((languages) => {
      const groups = [...languages.entries()]
        .map(([language, list]) => ({
          language,
          items: list.slice().sort((a, b) => (classDate(b.label) ?? "").localeCompare(classDate(a.label) ?? "")),
        }))
        .sort((a, b) => b.items.length - a.items.length || languageName(a.language).localeCompare(languageName(b.language)));
      const first = groups[0]!.items[0]!;
      return {
        teacher: classPdfTeacher(first.label).trim() || first.label,
        languages: groups,
        count: groups.reduce((n, g) => n + g.items.length, 0),
      };
    })
    .sort((a, b) => a.teacher.localeCompare(b.teacher));
}
