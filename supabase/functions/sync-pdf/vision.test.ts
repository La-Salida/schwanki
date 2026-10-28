import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert";
import { cleanTranscription, isImageType, transcribeImage, transcriptionPrompt } from "./vision.ts";

const picture = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: "image/jpeg" });

Deno.test("only picture uploads are read by the vision model", () => {
  assertEquals(isImageType("image/jpeg"), true);
  assertEquals(isImageType("IMAGE/PNG; charset=binary"), true);
  assertEquals(isImageType("application/pdf"), false);
  assertEquals(isImageType("text/plain"), false);
});

Deno.test("the prompt names the lesson language and keeps the teacher's wording", () => {
  const prompt = transcriptionPrompt("zh");
  assertStringIncludes(prompt, "Chinese lesson");
  assertStringIncludes(prompt, "exactly as written");
  assertStringIncludes(transcriptionPrompt("vi"), "vi lesson");
});

Deno.test("transcribeImage sends the picture inline to Fal and returns its text", async () => {
  let sent: { url: string; init: RequestInit } | null = null;
  const fetchFn = ((url: string, init: RequestInit) => {
    sent = { url, init };
    return Promise.resolve(Response.json({ output: "苹果 píngguǒ = apple\n" }));
  }) as unknown as typeof fetch;
  const text = await transcribeImage(picture, "zh", { apiKey: "k", fetchFn });
  assertEquals(text, "苹果 píngguǒ = apple");
  assertEquals(sent!.url, "https://fal.run/openrouter/router/vision");
  assertEquals((sent!.init.headers as Record<string, string>).authorization, "Key k");
  const body = JSON.parse(sent!.init.body as string);
  assertEquals(body.model, "google/gemini-2.5-flash");
  assertEquals(body.image_urls, ["data:image/jpeg;base64,/9j/4AECAw=="]);
});

Deno.test("transcribeImage explains provider and setup failures", async () => {
  await assertRejects(() => transcribeImage(picture, "zh", { apiKey: "" }), Error, "isn't set up");
  await assertRejects(() => transcribeImage(new Blob([], { type: "image/png" }), "zh", { apiKey: "k" }), Error, "empty");
  const failing = (() => Promise.resolve(new Response("busy", { status: 503 }))) as unknown as typeof fetch;
  await assertRejects(() => transcribeImage(picture, "zh", { apiKey: "k", fetchFn: failing }), Error, "HTTP 503: busy");
});

Deno.test("cleanTranscription drops a Markdown fence", () => {
  assertEquals(cleanTranscription("```text\n便宜 piányi = cheap\n```"), "便宜 piányi = cheap");
  assertEquals(cleanTranscription("  贵 guì  \n"), "贵 guì");
});
