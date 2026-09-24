import { assertEquals } from "jsr:@std/assert";
import { classifyHttpError } from "./classify.ts";

Deno.test("classifyHttpError: 400/401/403 → revoked (needs user re-auth)", () => {
  assertEquals(classifyHttpError(400), "revoked");
  assertEquals(classifyHttpError(401), "revoked");
  assertEquals(classifyHttpError(403), "revoked");
});

Deno.test("classifyHttpError: 429/5xx → transient error (self-heals next run)", () => {
  assertEquals(classifyHttpError(429), "error");
  assertEquals(classifyHttpError(500), "error");
  assertEquals(classifyHttpError(502), "error");
  assertEquals(classifyHttpError(503), "error");
});

Deno.test("classifyHttpError: other non-ok statuses → error", () => {
  assertEquals(classifyHttpError(404), "error");
  assertEquals(classifyHttpError(418), "error");
});
