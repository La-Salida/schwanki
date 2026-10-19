import { unzipSync } from "fflate";
import { decompress as zstd } from "fzstd";
import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import type { ReviewRating } from "@schwanki/core";
import { mapNote, type MappedNote, type NoteType } from "./fields";
import { protoNumber, protoString, readMessage } from "./protobuf";

/** One note from the deck, as the card it becomes in Schwanki plus its Anki scheduling. */
export interface AnkiCard {
  noteId: number;
  /** Full deck path, "Japanese::Core 2k". */
  deck: string;
  note: MappedNote;
  /** Anki card fields of the note's first card (cards.type/queue/due/ivl/reps/lapses). */
  type: number;
  queue: number;
  due: number;
  ivl: number;
  reps: number;
  lapses: number;
  /** Graded reviews from the review log, oldest first. */
  reviews: Array<{ at: Date; rating: ReviewRating }>;
}

export interface AnkiCollection {
  cards: AnkiCard[];
  /** Notes with no usable word or meaning (empty fields, image-only notes). */
  skipped: number;
  /** Collection creation time; review cards' due is counted in days from it. */
  created: Date;
  /** Media files by name; missing names are left out. */
  media(names: string[]): Map<string, Uint8Array>;
}

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const isZstd = (b: Uint8Array) => ZSTD_MAGIC.every((byte, i) => b[i] === byte);
const unzstd = (b: Uint8Array) => (isZstd(b) ? zstd(b) : b);
const RATINGS: Record<number, ReviewRating> = { 1: "again", 2: "hard", 3: "good", 4: "easy" };

function rows(db: Database, sql: string): SqlValue[][] {
  return db.exec(sql)[0]?.values ?? [];
}

/** Read an Anki .apkg or .colpkg export: legacy (collection.anki2/anki21) and current (anki21b) formats. */
export function readAnkiPackage(bytes: Uint8Array, SQL: SqlJsStatic): AnkiCollection {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (f) => f.name.startsWith("collection.") || f.name === "media" });
  } catch {
    throw new Error("This isn't an Anki export. Choose an .apkg or .colpkg file.");
  }
  const raw = entries["collection.anki21b"] ?? entries["collection.anki21"] ?? entries["collection.anki2"];
  if (!raw) throw new Error("This file has no Anki collection in it. Export it from Anki as an .apkg or .colpkg.");
  const db = new SQL.Database(entries["collection.anki21b"] ? unzstd(raw) : raw);
  try {
    const crt = Number(rows(db, "select crt from col")[0]?.[0] ?? 0);
    const modern = rows(db, "select 1 from sqlite_master where type='table' and name='notetypes'").length > 0;
    const types = modern ? modernNoteTypes(db) : legacyNoteTypes(db);
    const decks = modern ? modernDecks(db) : legacyDecks(db);

    const reviews = new Map<number, AnkiCard["reviews"]>();
    for (const [cid, id, ease, type] of rows(db, "select cid, id, ease, type from revlog order by id")) {
      const rating = RATINGS[Number(ease)];
      if (!rating || Number(type) === 4) continue; // manual reschedules carry no grade
      const list = reviews.get(Number(cid)) ?? [];
      list.push({ at: new Date(Number(id)), rating });
      reviews.set(Number(cid), list);
    }

    // The note's first card stands in for the note: Schwanki has one card per word.
    const firstCard = new Map<number, SqlValue[]>();
    for (const card of rows(db, "select nid, id, did, odid, ord, type, queue, due, ivl, reps, lapses from cards order by nid, ord")) {
      if (!firstCard.has(Number(card[0]))) firstCard.set(Number(card[0]), card);
    }

    const cards: AnkiCard[] = [];
    let skipped = 0;
    for (const [nid, mid, flds] of rows(db, "select id, mid, flds from notes order by id")) {
      const type = types.get(Number(mid));
      const card = firstCard.get(Number(nid));
      const note = type && card ? mapNote(type, String(flds).split("\x1f")) : null;
      if (!note || !card) { skipped++; continue; }
      const [, cid, did, odid, , ctype, queue, due, ivl, cardReps, cardLapses] = card.map(Number) as number[];
      cards.push({
        noteId: Number(nid),
        deck: decks.get(odid || did!) ?? decks.get(did!) ?? "Default",
        note,
        type: ctype!, queue: queue!, due: due!, ivl: ivl!, reps: cardReps!, lapses: cardLapses!,
        reviews: reviews.get(cid!) ?? [],
      });
    }
    return { cards, skipped, created: new Date(crt * 1000), media: mediaReader(bytes, entries["media"]) };
  } finally {
    db.close();
  }
}

function legacyNoteTypes(db: Database): Map<number, NoteType> {
  const models = JSON.parse(String(rows(db, "select models from col")[0]?.[0] ?? "{}")) as Record<string, {
    name: string; type: number; flds: Array<{ name: string; ord: number }>; tmpls: Array<{ ord: number; qfmt: string; afmt: string }>;
  }>;
  const types = new Map<number, NoteType>();
  for (const [id, m] of Object.entries(models)) {
    const tmpl = m.tmpls.slice().sort((a, b) => a.ord - b.ord)[0];
    types.set(Number(id), {
      name: m.name, cloze: m.type === 1,
      fields: m.flds.slice().sort((a, b) => a.ord - b.ord).map((f) => f.name),
      qfmt: tmpl?.qfmt ?? "", afmt: tmpl?.afmt ?? "",
    });
  }
  return types;
}

function modernNoteTypes(db: Database): Map<number, NoteType> {
  const types = new Map<number, NoteType>();
  for (const [id, name, config] of rows(db, "select id, name, config from notetypes")) {
    const kind = protoNumber(readMessage(config as Uint8Array), 1);
    types.set(Number(id), { name: String(name), cloze: kind === 1, fields: [], qfmt: "", afmt: "" });
  }
  for (const [ntid, name] of rows(db, "select ntid, name from fields order by ntid, ord")) {
    types.get(Number(ntid))?.fields.push(String(name));
  }
  for (const [ntid, config] of rows(db, "select ntid, config from templates where ord = (select min(ord) from templates t where t.ntid = templates.ntid)")) {
    const type = types.get(Number(ntid));
    if (!type) continue;
    const msg = readMessage(config as Uint8Array);
    type.qfmt = protoString(msg, 1);
    type.afmt = protoString(msg, 2);
  }
  return types;
}

function legacyDecks(db: Database): Map<number, string> {
  const decks = JSON.parse(String(rows(db, "select decks from col")[0]?.[0] ?? "{}")) as Record<string, { name: string }>;
  return new Map(Object.entries(decks).map(([id, d]) => [Number(id), d.name]));
}

function modernDecks(db: Database): Map<number, string> {
  return new Map(rows(db, "select id, name from decks").map(([id, name]) => [Number(id), String(name).split("\x1f").join("::")]));
}

/** Map media names to their zip entries ("0", "1", …); legacy indexes are JSON, current ones protobuf. */
function mediaReader(zip: Uint8Array, index: Uint8Array | undefined): AnkiCollection["media"] {
  const entryFor = new Map<string, string>();
  if (index && index.length > 0) {
    const data = unzstd(index);
    if (data[0] === 0x7b) { // "{"
      const map = JSON.parse(new TextDecoder().decode(data)) as Record<string, string>;
      for (const [entry, name] of Object.entries(map)) entryFor.set(name, entry);
    } else {
      (readMessage(data).get(1) ?? []).forEach((entry, i) => {
        if (entry instanceof Uint8Array) entryFor.set(protoString(readMessage(entry), 1), String(i));
      });
    }
  }
  return (names) => {
    const wanted = new Map(names.flatMap((n) => (entryFor.has(n) ? [[entryFor.get(n)!, n] as const] : [])));
    if (wanted.size === 0) return new Map();
    const files = unzipSync(zip, { filter: (f) => wanted.has(f.name) });
    return new Map(Object.entries(files).map(([entry, data]) => [wanted.get(entry)!, unzstd(data)]));
  };
}
