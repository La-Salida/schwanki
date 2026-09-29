import { assertEquals } from "jsr:@std/assert";
import { rateLimited, storagePath, OUR_KEY_ENV, normalizeModel, normalizeModels, normalizeKinds, normalizeVoice } from "./lib.ts";

Deno.test("rateLimited: 30 generations (90 media rows) per hour", () => {
  assertEquals(rateLimited(0), false);
  assertEquals(rateLimited(89), false);
  assertEquals(rateLimited(90), true);
  assertEquals(rateLimited(150), true);
});

Deno.test("storagePath is owner-scoped under the bucket rules", () => {
  assertEquals(storagePath("user-1", "card-9", "g-3", "image"), "user-1/card-9/g-3-image.png");
  assertEquals(storagePath("user-1", "card-9", "g-3", "audio"), "user-1/card-9/g-3-audio.mp3");
});

Deno.test("OUR_KEY_ENV maps providers to env var names", () => {
  assertEquals(OUR_KEY_ENV.anthropic, "ANTHROPIC_API_KEY");
  assertEquals(OUR_KEY_ENV.openai, "OPENAI_API_KEY");
  assertEquals(OUR_KEY_ENV.fal, "FAL_KEY");
  assertEquals(OUR_KEY_ENV.together, "TOGETHER_API_KEY");
  assertEquals(OUR_KEY_ENV.higgsfield, "HIGGSFIELD_API_KEY");
  assertEquals(OUR_KEY_ENV.openrouter, "OPENROUTER_API_KEY");
});

Deno.test("normalizeModel trims + validates model slugs (max 100 chars)", () => {
  // missing / non-string
  assertEquals(normalizeModel(undefined), null);
  assertEquals(normalizeModel(42), null);
  // blank
  assertEquals(normalizeModel(""), null);
  assertEquals(normalizeModel("   "), null);
  // valid slugs (returned trimmed)
  assertEquals(normalizeModel("deepseek/deepseek-chat"), "deepseek/deepseek-chat");
  assertEquals(normalizeModel("  deepseek/deepseek-chat  "), "deepseek/deepseek-chat");
  assertEquals(normalizeModel("z-ai/glm-5.2:free"), "z-ai/glm-5.2:free");
  assertEquals(normalizeModel("gpt-4o-mini"), "gpt-4o-mini");
  // invalid
  assertEquals(normalizeModel("bad slug!"), null);
  assertEquals(normalizeModel("a".repeat(101)), null);
  // exactly 100 allowed
  assertEquals(normalizeModel("a".repeat(100)), "a".repeat(100));
});

Deno.test("normalizeModels validates the per-kind model map", () => {
  // absent / empty → {}
  assertEquals(normalizeModels(undefined), {});
  assertEquals(normalizeModels({}), {});
  // single kind, returned trimmed
  assertEquals(normalizeModels({ sentence: "z-ai/glm-4.6" }), { sentence: "z-ai/glm-4.6" });
  // all three kinds, all trimmed/present
  assertEquals(
    normalizeModels({ sentence: " x ", image: "fal-ai/flux/schnell", audio: "tts-1-hd" }),
    { sentence: "x", image: "fal-ai/flux/schnell", audio: "tts-1-hd" },
  );
  // invalid slug → null
  assertEquals(normalizeModels({ sentence: "bad slug!" }), null);
  // non-string field → null
  assertEquals(normalizeModels({ audio: 42 }), null);
  // unknown kind key → null (reject, don't silently drop)
  assertEquals(normalizeModels({ video: "x/y" }), null);
  // whitespace-only field → null ("" after trim is invalid)
  assertEquals(normalizeModels({ sentence: "   " }), null);
});

Deno.test("normalizeKinds defaults, validates and canonicalizes the requested kinds", () => {
  // absent → full run (sentence, image, audio)
  assertEquals(normalizeKinds(undefined), ["sentence", "image", "audio"]);
  // valid subset
  assertEquals(normalizeKinds(["sentence"]), ["sentence"]);
  assertEquals(normalizeKinds(["audio"]), ["audio"]);
  assertEquals(normalizeKinds(["image", "audio"]), ["image", "audio"]);
  // dedupe + reorder into canonical sentence→image→audio
  assertEquals(normalizeKinds(["audio", "image", "audio"]), ["image", "audio"]);
  assertEquals(normalizeKinds(["audio", "sentence", "image"]), ["sentence", "image", "audio"]);
  // empty array → null (a run must attempt at least one kind)
  assertEquals(normalizeKinds([]), null);
  // unknown string → null
  assertEquals(normalizeKinds(["sentence", "video"]), null);
  // bare string (not an array) → null
  assertEquals(normalizeKinds("image"), null);
  // non-array non-undefined types → null
  assertEquals(normalizeKinds(42), null);
  assertEquals(normalizeKinds(null), null);
});

Deno.test("normalizeVoice: optional voice id/name, strict charset", () => {
  assertEquals(normalizeVoice(undefined), "");
  assertEquals(normalizeVoice(null), "");
  assertEquals(normalizeVoice("   "), "");
  assertEquals(normalizeVoice("nativeZhVoice123"), "nativeZhVoice123");
  assertEquals(normalizeVoice(" Rachel "), "Rachel");
  assertEquals(normalizeVoice("nova"), "nova");
  // invalid: wrong type, bad chars, too long
  assertEquals(normalizeVoice(42), null);
  assertEquals(normalizeVoice("bad;voice"), null);
  assertEquals(normalizeVoice("a".repeat(65)), null);
});
