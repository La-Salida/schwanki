/** Turning an Anki note's fields into a Schwanki card: word, meaning, reading, example, media. */

export interface NoteType {
  name: string;
  cloze: boolean;
  fields: string[];
  /** Question and answer template of the note type's first card type. */
  qfmt: string;
  afmt: string;
}

export interface MappedNote {
  front: string;
  back: string;
  reading?: string;
  exampleSentence?: string;
  image?: string;
  audio?: string;
}

const SPECIAL = new Set(["frontside", "tags", "deck", "subdeck", "type", "card", "cardflag", "cloze"]);
const READING = /reading|pinyin|romaji|romani[sz]ation|kana|furigana|pronunciation|jyutping|zhuyin|bopomofo|hiragana|transliteration|ipa\b/i;
const EXAMPLE = /example|sentence|context|usage/i;

/** Field names a template shows, in order: {{Front}}, {{text:Back}}, {{furigana:Reading}}. */
export function templateFields(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(/\{\{([^}]+)\}\}/g)) {
    const raw = match[1]!.trim();
    if (/^[#^/!]/.test(raw)) continue; // conditionals and comments
    const name = raw.split(":").pop()!.trim();
    if (!name || SPECIAL.has(name.toLowerCase()) || names.includes(name)) continue;
    names.push(name);
  }
  return names;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Plain text of a field: no HTML, no [sound:] tags, line breaks kept. */
export function fieldText(html: string): string {
  const text = html
    .replace(/\[sound:[^\]]*\]/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(div|p|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(text)
    .split("\n").map((line) => line.replace(/[ \t ]+/g, " ").trim()).filter(Boolean).join("\n");
}

export function firstImage(html: string): string | undefined {
  const src = /<img[^>]*\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(html);
  const name = src?.[1] ?? src?.[2] ?? src?.[3];
  return name ? decodeEntities(name) : undefined;
}

export function firstSound(html: string): string | undefined {
  return /\[sound:([^\]]+)\]/.exec(html)?.[1];
}

/** Japanese furigana markup "漢字[かんじ]" split into the word and its reading. */
export function splitFurigana(text: string): { text: string; reading?: string } {
  if (!/\[[^\]]+\]/.test(text)) return { text };
  const plain = text.replace(/ ?([^ [\]]+)\[[^\]]+\]/g, "$1");
  const reading = text.replace(/ ?[^ [\]]+\[([^\]]+)\]/g, "$1");
  return { text: plain.trim(), reading: reading.trim() };
}

/** Cloze text with the deletions hidden ([…] or the hint) or revealed. */
export function clozeSide(text: string, reveal: boolean): string {
  return text.replace(/\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (_m, answer: string, hint?: string) =>
    reveal ? answer : `[${hint ?? "…"}]`);
}

export function mapNote(type: NoteType, values: string[]): MappedNote | null {
  const byName = new Map(type.fields.map((name, i) => [name, values[i] ?? ""]));
  const all = values.join(" ");
  const media = { image: firstImage(all), audio: firstSound(all) };
  const text = (name: string) => fieldText(byName.get(name) ?? "");

  if (type.cloze) {
    const [main = "", ...rest] = type.fields;
    const raw = fieldText(byName.get(main) ?? "");
    const extra = rest.map(text).filter(Boolean).join("\n");
    const front = clozeSide(raw, false);
    const back = [clozeSide(raw, true), extra].filter(Boolean).join("\n");
    return front && back ? withMedia({ front, back }, media) : null;
  }

  const known = (names: string[]) => names.filter((n) => byName.has(n));
  const question = known(templateFields(type.qfmt));
  const answerOnly = known(templateFields(type.afmt)).filter((n) => !question.includes(n));
  // Templates that show nothing we recognise: fall back to field order.
  const front_ = question.length > 0 ? question : type.fields.slice(0, 1);
  const rest = answerOnly.length > 0 ? answerOnly : type.fields.filter((n) => !front_.includes(n));

  let front = "";
  let reading: string | undefined;
  let example: string | undefined;
  const meaning: string[] = [];
  for (const name of front_) {
    const value = text(name);
    if (!value) continue;
    if (!front) front = value;
    else if (!reading && READING.test(name)) reading = value;
  }
  for (const name of rest) {
    const value = text(name);
    if (!value) continue;
    if (READING.test(name)) reading ??= value;
    else if (EXAMPLE.test(name)) example ??= value;
    else meaning.push(value);
  }
  const furigana = splitFurigana(front);
  front = furigana.text;
  reading ??= furigana.reading;
  const back = meaning.join("\n");
  if (!front || !back) return null;
  return withMedia({ front, back, ...(reading ? { reading } : {}), ...(example ? { exampleSentence: example } : {}) }, media);
}

function withMedia(note: MappedNote, media: { image: string | undefined; audio: string | undefined }): MappedNote {
  return { ...note, ...(media.image ? { image: media.image } : {}), ...(media.audio ? { audio: media.audio } : {}) };
}
