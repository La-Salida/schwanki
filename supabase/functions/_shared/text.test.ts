import { assertEquals } from "jsr:@std/assert";
import { cleanText } from "./text.ts";

Deno.test("cleanText drops NUL bytes and lone surrogates", () => {
  assertEquals(cleanText("สวัส\u0000ดี"), "สวัสดี");
  assertEquals(cleanText("a\uD800b\uDC00c"), "abc");
});

Deno.test("cleanText keeps valid surrogate pairs", () => {
  assertEquals(cleanText("ok 😀 ไทย"), "ok 😀 ไทย");
});
