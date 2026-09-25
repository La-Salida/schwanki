import { assertEquals } from "jsr:@std/assert";
import { addedLines, extractGoogleFileId } from "./diff.ts";

Deno.test("extractGoogleFileId parses docs and sheets URLs", () => {
  assertEquals(
    extractGoogleFileId("https://docs.google.com/spreadsheets/d/1NvHzms9UKuxxWA5sH1mOYCS5YIuIGtpBC0L3LdyWcjg/edit?usp=sharing"),
    "1NvHzms9UKuxxWA5sH1mOYCS5YIuIGtpBC0L3LdyWcjg",
  );
  assertEquals(
    extractGoogleFileId("https://docs.google.com/document/d/1zyDnpi-l7Jh3SKvuCBTHT-isO-z2NjT_vq_I_0bqZCU/edit?tab=t.0"),
    "1zyDnpi-l7Jh3SKvuCBTHT-isO-z2NjT_vq_I_0bqZCU",
  );
  assertEquals(extractGoogleFileId("https://example.com"), null);
});

Deno.test("addedLines: first sync returns everything", () => {
  assertEquals(addedLines(null, "a\nb\n"), ["a", "b"]);
});

Deno.test("addedLines: append-only lesson diff returns just new lines", () => {
  const old = ",自信,confidence,zì xìn,\n,投资,invest,tóu zī,";
  const next = old + "\n,退休,retire,tuì xiū,";
  assertEquals(addedLines(old, next), [",退休,retire,tuì xiū,"]);
});

Deno.test("addedLines: ignores whitespace-only churn and blanks", () => {
  assertEquals(addedLines("a", "a \n\n b"), ["b"]);
});

Deno.test("addedLines: no change returns empty (free no-op sync)", () => {
  assertEquals(addedLines("a\nb", "a\nb"), []);
});
