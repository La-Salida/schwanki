import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { prepareClassDocument } from "./classDocument";

const presentation = '<p:presentation xmlns:p="urn:p" xmlns:r="urn:r"><p:sldIdLst><p:sldId r:id="second"/><p:sldId r:id="first"/></p:sldIdLst></p:presentation>';
const relationships = '<Relationships><Relationship Id="first" Target="slides/slide1.xml"/><Relationship Id="second" Target="slides/slide2.xml"/></Relationships>';
const slide = (text: string) => strToU8(`<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`);

function deck(extra: Record<string, Uint8Array> = {}) {
  return new File([zipSync({
    "ppt/presentation.xml": strToU8(presentation),
    "ppt/_rels/presentation.xml.rels": strToU8(relationships),
    "ppt/slides/slide1.xml": slide("谢谢 &amp; thank you"),
    "ppt/slides/slide2.xml": slide("สวัสดี hello"),
    ...extra,
  }, { level: 0 })], "26-10-23.pptx");
}

describe("prepareClassDocument", () => {
  it("imports a PowerPoint over 10 MB as small UTF-8 text in presentation order", async () => {
    const file = deck({ "ppt/media/video.mp4": new Uint8Array(11 * 1024 * 1024) });
    expect(file.size).toBeGreaterThan(10 * 1024 * 1024);
    const result = await prepareClassDocument(file);
    expect(result.type).toBe("text/plain");
    expect(result.size).toBeLessThan(1000);
    expect(await readText(result)).toBe("สวัสดี hello\n\n谢谢 & thank you");
  });

  it("joins text runs without spaces and preserves paragraph boundaries", async () => {
    const result = await prepareClassDocument(deck({
      "ppt/slides/slide2.xml": strToU8('<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>你</a:t></a:r><a:r><a:t>好</a:t></a:r><a:br/><a:r><a:t>hello</a:t></a:r></a:p><a:p><a:r><a:t>world</a:t></a:r></a:p></p:sld>'),
    }));
    expect(await readText(result)).toContain("你好\nhello\nworld");
  });

  it("rejects image-only decks with an actionable error", async () => {
    await expect(prepareClassDocument(deck({
      "ppt/slides/slide1.xml": slide(""), "ppt/slides/slide2.xml": slide(""),
    }))).rejects.toThrow(/no readable slide text/i);
  });

  it("rejects broken decks and unsupported files before upload", async () => {
    await expect(prepareClassDocument(new File(["broken"], "lesson.pptx"))).rejects.toThrow(/could not read/i);
    await expect(prepareClassDocument(new File(["old"], "lesson.ppt"))).rejects.toThrow(/\.pptx or PDF/i);
    await expect(prepareClassDocument(deck({ "ppt/slides/slide1.xml": strToU8("<broken>") }))).rejects.toThrow(/could not read/i);
  });

  it("rejects missing slide relationships instead of silently dropping slides", async () => {
    await expect(prepareClassDocument(deck({ "ppt/_rels/presentation.xml.rels": strToU8("<Relationships/>") }))).rejects.toThrow(/could not read/i);
  });

  it("keeps ordinary PDFs unchanged and explains their size limit", async () => {
    const pdf = new File(["%PDF"], "lesson.pdf", { type: "application/pdf" });
    expect(await prepareClassDocument(pdf)).toBe(pdf);
    const large = new File([new Uint8Array(11 * 1024 * 1024)], "lesson.pdf");
    await expect(prepareClassDocument(large)).rejects.toThrow(/10 MB.*PowerPoint/i);
  });

  it("preserves PDF identity when the browser reports text/plain or no MIME type", async () => {
    for (const type of ["text/plain", ""]) {
      const file = new File(["%PDF-1.4\nPDF bytes"], "lesson.pdf", { type });
      const prepared = await prepareClassDocument(file);
      expect(prepared.type).toBe("application/pdf");
      expect(await readText(prepared)).toBe("%PDF-1.4\nPDF bytes");
    }
  });

  it("bounds input size and inflated XML before processing", async () => {
    const file = deck();
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });
    await expect(prepareClassDocument(file)).rejects.toThrow(/100 MB/i);
    await expect(prepareClassDocument(deck({
      "ppt/slides/slide1.xml": new Uint8Array(5 * 1024 * 1024),
    }))).rejects.toThrow(/too much slide text/i);
  });
});

function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
