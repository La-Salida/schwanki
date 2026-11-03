import type { MediaKind, Source, Teacher } from "@schwanki/core";
import { classPdfTeacher } from "@/lib/classPdf";
import { teacherKey } from "@/lib/groupSources";
import { supabase } from "@/lib/supabase";

/** Every teacher in a language. */
export const ANY_TEACHER = "*";
export const DEFAULT_DAILY_LIMIT = 25;

export interface AutoGenerateSettings { decks: string[]; kinds: MediaKind[]; dailyLimit: number }
export const AUTO_OFF: AutoGenerateSettings = { decks: [], kinds: ["sentence", "image", "audio"], dailyLimit: DEFAULT_DAILY_LIMIT };

/** The key the database trigger matches: lowercased teacher name and language. */
export const deckKey = (teacher: string, language: string) => `${teacherKey(teacher)}|${language}`;

export interface LanguageTeachers { language: string; teachers: string[] }

/** Teachers the learner can pick, by language: from class notes they've added
 *  and from teachers saved with a Preply link before any notes exist. Anki decks
 *  are left out because the setting never applies to them. */
export function teacherChoices(sources: Array<Pick<Source, "label" | "language" | "type">>, teachers: Teacher[]): LanguageTeachers[] {
  const byLanguage = new Map<string, Map<string, string>>();
  const add = (name: string, language: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const names = byLanguage.get(language) ?? new Map<string, string>();
    if (!names.has(teacherKey(trimmed))) names.set(teacherKey(trimmed), trimmed);
    byLanguage.set(language, names);
  };
  for (const s of sources) if (s.type !== "anki_deck") add(classPdfTeacher(s.label), s.language);
  for (const t of teachers) if (t.language) add(t.name, t.language);
  return [...byLanguage.entries()]
    .map(([language, names]) => ({ language, teachers: [...names.values()].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.language.localeCompare(b.language));
}

export async function loadAutoGenerate(): Promise<AutoGenerateSettings> {
  const { data, error } = await supabase.from("auto_generate_settings").select("decks, kinds, daily_limit").maybeSingle();
  if (error) throw error;
  if (!data) return AUTO_OFF;
  return { decks: data.decks as string[], kinds: data.kinds as MediaKind[], dailyLimit: data.daily_limit as number };
}

export async function saveAutoGenerate(s: AutoGenerateSettings): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("not signed in");
  const { error } = await supabase.from("auto_generate_settings").upsert({
    user_id: session.user.id, decks: s.decks, kinds: s.kinds, daily_limit: s.dailyLimit, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
