import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { extractPdfText } from "./pdf.ts";

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
