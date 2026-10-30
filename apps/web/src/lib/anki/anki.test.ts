// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { zstdCompressSync } from "node:zlib";
import { zipSync, strToU8 } from "fflate";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { readAnkiPackage, openAnkiPackage, readAnkiCollection, type SqlValue } from "./package";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planImport, guessLanguage } from "./plan";
import { clozeSide, fieldText, mapNote, splitFurigana, templateFields } from "./fields";

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });

const DAY = 86_400_000;
const CRT = Date.UTC(2025, 0, 1) / 1000;
const NOW = new Date(Date.UTC(2026, 9, 19, 10));
const BASIC = { qfmt: "{{Front}}", afmt: "{{FrontSide}}<hr id=answer>{{Back}}" };

/* Minimal protobuf writer for the current (anki21b) format's config blobs and media index. */
function varint(n: number): number[] {
  const out: number[] = [];
  while (n >= 0x80) { out.push((n % 128) | 0x80); n = Math.floor(n / 128); }
  out.push(n);
  return out;
}
function proto(fields: Array<[number, number | string | Uint8Array]>): Uint8Array {
  const out: number[] = [];
  for (const [field, value] of fields) {
    if (typeof value === "number") out.push(...varint(field * 8), ...varint(value));
    else {
      const bytes = typeof value === "string" ? strToU8(value) : value;
      out.push(...varint(field * 8 + 2), ...varint(bytes.length), ...bytes);
    }
  }
  return new Uint8Array(out);
}

interface FixtureNote { id: number; flds: string[]; did?: number; card: Partial<{ type: number; queue: number; due: number; ivl: number; reps: number; lapses: number }>; revlog?: Array<[number, number]> }

function collection(modern: boolean, notes: FixtureNote[], noteType = { cloze: false, fields: ["Front", "Back"], ...BASIC }): Uint8Array {
  const db = new SQL.Database();
  db.run("create table notes (id integer, mid integer, flds text)");
  db.run("create table cards (id integer, nid integer, did integer, odid integer, ord integer, type integer, queue integer, due integer, ivl integer, reps integer, lapses integer)");
  db.run("create table revlog (id integer, cid integer, ease integer, type integer)");
  const decks = { 1: "Default", 2: "Japanese::Core 2k" };
  if (modern) {
    db.run("create table col (crt integer)");
    db.run("insert into col values (?)", [CRT]);
    db.run("create table notetypes (id integer, name text, config blob)");
    db.run("create table fields (ntid integer, ord integer, name text)");
    db.run("create table templates (ntid integer, ord integer, config blob)");
    db.run("create table decks (id integer, name text)");
    db.run("insert into notetypes values (7, 'Basic', ?)", [proto([[1, noteType.cloze ? 1 : 0]])]);
    noteType.fields.forEach((name, ord) => db.run("insert into fields values (7, ?, ?)", [ord, name]));
    db.run("insert into templates values (7, 0, ?)", [proto([[1, noteType.qfmt], [2, noteType.afmt]])]);
    for (const [id, name] of Object.entries(decks)) db.run("insert into decks values (?, ?)", [Number(id), name.replace("::", "\x1f")]);
  } else {
    db.run("create table col (crt integer, models text, decks text)");
    const models = { 7: { name: "Basic", type: noteType.cloze ? 1 : 0, flds: noteType.fields.map((name, ord) => ({ name, ord })), tmpls: [{ ord: 0, qfmt: noteType.qfmt, afmt: noteType.afmt }] } };
    db.run("insert into col values (?, ?, ?)", [CRT, JSON.stringify(models), JSON.stringify(Object.fromEntries(Object.entries(decks).map(([id, name]) => [id, { name }])))]);
  }
  for (const n of notes) {
    db.run("insert into notes values (?, 7, ?)", [n.id, n.flds.join("\x1f")]);
    const c = { type: 0, queue: 0, due: n.id, ivl: 0, reps: 0, lapses: 0, ...n.card };
    db.run("insert into cards values (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)", [n.id * 10, n.id, n.did ?? 2, c.type, c.queue, c.due, c.ivl, c.reps, c.lapses]);
    for (const [at, ease] of n.revlog ?? []) db.run("insert into revlog values (?, ?, ?, 1)", [at, n.id * 10, ease]);
  }
  const bytes = db.export();
  db.close();
  return bytes;
}

const notes: FixtureNote[] = [
  { id: 1, flds: ["猫", "cat <img src=\"cat.png\">"], card: {} },
  { id: 2, flds: ["犬", "dog[sound:inu.mp3]"], card: { type: 2, queue: 2, due: 600, ivl: 30, reps: 6, lapses: 1 } },
  {
    id: 3, flds: ["鳥", "bird"], card: { type: 2, queue: 2, due: 650, ivl: 10, reps: 3 },
    revlog: [[Date.UTC(2026, 8, 1), 3], [Date.UTC(2026, 8, 4), 3], [Date.UTC(2026, 8, 12), 1], [Date.UTC(2026, 8, 13), 3]],
  },
  { id: 4, flds: ["魚", "fish"], card: { queue: -1 } },
  { id: 5, flds: ["", "<img src=\"only.png\">"], card: {} },
];

function legacyApkg(): Uint8Array {
  return zipSync({
    "collection.anki2": collection(false, notes),
    media: strToU8(JSON.stringify({ 0: "cat.png", 1: "inu.mp3" })),
    0: new Uint8Array([1, 2, 3]),
    1: new Uint8Array([4, 5]),
  });
}

function modernApkg(): Uint8Array {
  const index = proto([[1, proto([[1, "cat.png"], [2, 3]])], [1, proto([[1, "inu.mp3"], [2, 2]])]]);
  return zipSync({
    "collection.anki2": new Uint8Array([0]), // placeholder older Anki versions see
    "collection.anki21b": zstdCompressSync(collection(true, notes)),
    media: zstdCompressSync(index),
    0: zstdCompressSync(new Uint8Array([1, 2, 3])),
    1: new Uint8Array([4, 5]),
  });
}

describe.each([["legacy .apkg", legacyApkg], ["current .apkg (anki21b)", modernApkg]])("reading a %s", (_label, build) => {
  it("turns notes into cards with deck, fields, media and history", () => {
    const col = readAnkiPackage(build(), SQL);
    expect(col.created.getTime()).toBe(CRT * 1000);
    expect(col.skipped).toBe(1);
    expect(col.cards.map((c) => c.note.front)).toEqual(["猫", "犬", "鳥", "魚"]);
    const [cat, dog, bird] = col.cards;
    expect(cat!.deck).toBe("Japanese::Core 2k");
    expect(cat!.note).toMatchObject({ back: "cat", image: "cat.png" });
    expect(dog!.note).toMatchObject({ back: "dog", audio: "inu.mp3" });
    expect(bird!.reviews.map((r) => r.rating)).toEqual(["good", "good", "again", "good"]);
    const media = col.media(["cat.png", "inu.mp3", "missing.jpg"]);
    expect([...media.keys()].sort()).toEqual(["cat.png", "inu.mp3"]);
    expect([...media.get("cat.png")!]).toEqual([1, 2, 3]);
  });

  it("reads the identical collection through a native SQLite adapter", () => {
    const opened = openAnkiPackage(build(), { collectionBytes: 1024 * 1024, mediaBytes: 1024 });
    const folder = mkdtempSync(join(tmpdir(), "schwanki-anki-"));
    const file = join(folder, "collection.db"); writeFileSync(file, opened.database);
    const native = new DatabaseSync(file);
    try {
      const col = readAnkiCollection({
        exec(sql) { const statement = native.prepare(sql); statement.setReturnArrays(true); return [{ values: statement.all() as unknown as SqlValue[][] }]; },
        close() { native.close(); },
      }, opened.media);
      const web = readAnkiPackage(build(), SQL);
      expect(col.cards).toEqual(web.cards);
      expect([...col.media(["cat.png"]).get("cat.png")!]).toEqual([1,2,3]);
      expect(planImport(col, NOW)).toEqual(planImport(web, NOW));
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });

  it("plans schedules: history replayed, intervals kept, new cards paced, suspended left out", () => {
    const plan = planImport(readAnkiPackage(build(), SQL), NOW, 1);
    expect(plan.suspended).toBe(1);
    expect(plan.decks).toHaveLength(1);
    const deck = plan.decks[0]!;
    expect(deck.name).toBe("Japanese");
    expect(deck.reviewed).toBe(2);
    const by = Object.fromEntries(deck.cards.map((c) => [c.card.note.front, c.state]));
    expect(by["猫"]!.dueAt).toEqual(NOW); // first new card today
    expect(by["犬"]!.dueAt.getTime()).toBe(CRT * 1000 + 600 * DAY);
    expect(by["犬"]!.stability).toBe(30);
    expect(by["鳥"]!.reps).toBe(4);
    expect(by["鳥"]!.lastReviewedAt).toEqual(new Date(Date.UTC(2026, 8, 13)));
  });
});

it("spreads unseen cards over days in Anki's order", () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, flds: [`w${i}`, `m${i}`], card: { due: 5 - i } }));
  const plan = planImport(readAnkiPackage(zipSync({ "collection.anki2": collection(false, many) }), SQL), NOW, 2);
  const due = Object.fromEntries(plan.decks[0]!.cards.map((c) => [c.card.note.front, c.state.dueAt.getTime()]));
  expect(due["w4"]).toBe(NOW.getTime());
  expect(due["w3"]).toBe(NOW.getTime());
  expect(due["w2"]!).toBeGreaterThan(NOW.getTime());
  expect(due["w0"]!).toBeGreaterThan(due["w2"]!);
});

it("rejects files that aren't Anki exports", () => {
  expect(() => readAnkiPackage(new Uint8Array([1, 2, 3]), SQL)).toThrow(/Anki export/);
  expect(() => readAnkiPackage(zipSync({ "notes.txt": strToU8("hi") }), SQL)).toThrow(/no Anki collection/);
});

describe("field mapping", () => {
  it("reads which fields a template shows", () => {
    expect(templateFields("{{#Reading}}{{furigana:Reading}}{{/Reading}} {{Word}} {{Tags}}")).toEqual(["Reading", "Word"]);
  });

  it("strips HTML and decodes entities", () => {
    expect(fieldText("<div>to&nbsp;eat</div><div>&lt;verb&gt; &#39;x&#39;</div>[sound:a.mp3]")).toBe("to eat\n<verb> 'x'");
  });

  it("decodes percent-escaped image names to match the media index", () => {
    const type = { name: "Basic", cloze: false, fields: ["Front", "Back"], ...BASIC };
    expect(mapNote(type, ["猫", "cat <img src=\"hello%20100%25.jpg\">"])?.image).toBe("hello 100%.jpg");
    expect(mapNote(type, ["猫", "cat <img src=\"50%off.png\">"])?.image).toBe("50%off.png");
  });

  it("splits furigana and hides cloze deletions", () => {
    expect(splitFurigana("日本[にほん] 語[ご]")).toEqual({ text: "日本語", reading: "にほんご" });
    expect(clozeSide("{{c1::Paris}} is in {{c2::France::country}}", false)).toBe("[…] is in [country]");
    expect(clozeSide("{{c1::Paris}} is in {{c2::France::country}}", true)).toBe("Paris is in France");
  });

  it("sorts extra fields into reading, example and meaning", () => {
    const type = { name: "Vocab", cloze: false, fields: ["Word", "Pinyin", "Meaning", "Example"], qfmt: "{{Word}}", afmt: "{{FrontSide}}{{Pinyin}}{{Meaning}}{{Example}}" };
    expect(mapNote(type, ["你好", "nǐ hǎo", "hello", "你好吗？"])).toEqual({ front: "你好", back: "hello", reading: "nǐ hǎo", exampleSentence: "你好吗？" });
  });

  it("maps cloze notes", () => {
    const type = { name: "Cloze", cloze: true, fields: ["Text", "Back Extra"], qfmt: "{{cloze:Text}}", afmt: "{{cloze:Text}}<br>{{Back Extra}}" };
    expect(mapNote(type, ["{{c1::犬}}が好き", "I like dogs"])).toEqual({ front: "[…]が好き", back: "犬が好き\nI like dogs" });
  });
});

it("guesses the language from the script", () => {
  expect(guessLanguage(["食べる", "猫"])).toBe("ja");
  expect(guessLanguage(["你好"])).toBe("zh");
  expect(guessLanguage(["안녕"])).toBe("ko");
  expect(guessLanguage(["hola"])).toBeNull();
});

it("bounds expanded collections before handing them to native SQLite", () => {
  expect(() => openAnkiPackage(legacyApkg(), { collectionBytes: 10 })).toThrow(/supported size/);
  expect(() => openAnkiPackage(modernApkg(), { collectionBytes: 1024 })).toThrow(/supported size/);
});
it("bounds the Zstd-expanded media index as well as the collection", () => {
  const oversizedIndex = zipSync({
    "collection.anki2": new Uint8Array([0]),
    media: zstdCompressSync(new Uint8Array(4096)),
  });
  expect(() => openAnkiPackage(oversizedIndex, { collectionBytes: 1024 })).toThrow(/supported size|too much memory/);
});
it("retains media retry work as a per-item error when media exceeds the native bound", () => {
  const opened = openAnkiPackage(modernApkg(), { mediaBytes: 1 });
  const col = readAnkiCollection(new SQL.Database(opened.database), opened.media);
  expect(() => col.media(["cat.png"])).toThrow(/too large|supported size/);
});
