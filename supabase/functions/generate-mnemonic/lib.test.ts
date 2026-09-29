import { assertEquals } from "jsr:@std/assert";
import { rateLimited, storagePath, OUR_KEY_ENV, normalizeModel } from "./lib.ts";

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
