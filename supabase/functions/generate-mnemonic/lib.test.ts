import { assertEquals } from "jsr:@std/assert";
import { rateLimited, storagePath, OUR_KEY_ENV } from "./lib.ts";

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
});
