import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { extractPdfText, extractSourceText } from "./pdf.ts";

Deno.test("source extraction preserves prepared PowerPoint text and Unicode", async () => {
  const text = "谢谢 — thank you\nสวัสดี — hello";
  assertEquals(await extractSourceText(new Blob([text], { type: "text/plain;charset=utf-8" })), text);
});

Deno.test("source extraction still reads uploaded PDFs", async () => {
  const bytes = await Deno.readFile(new URL("./fixtures/hello.pdf", import.meta.url));
  assertStringIncludes(await extractSourceText(new Blob([bytes], { type: "application/pdf" })), "Hello world");
});

Deno.test("extractPdfText reads text from a real PDF", async () => {
  const bytes = await Deno.readFile(new URL("./fixtures/hello.pdf", import.meta.url));
  const text = await extractPdfText(bytes);
  assertStringIncludes(text, "Hello world");
  assertStringIncludes(text, "xiexie - thank you");
});

Deno.test("extractPdfText rejects non-PDF bytes", async () => {
  let threw = false;
  try {
    await extractPdfText(new TextEncoder().encode("not a pdf"));
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
