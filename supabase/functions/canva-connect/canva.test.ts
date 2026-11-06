import { assert, assertEquals } from "jsr:@std/assert@1";
import { appReturn, authorizeUrl, codeChallenge, designRef, summarizeDesign } from "./canva.ts";

Deno.test("PKCE challenge matches RFC 7636's example", async () => {
  assertEquals(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

Deno.test("authorize URL asks only to read designs, with PKCE", () => {
  const url = new URL(authorizeUrl("cid", "https://x.supabase.co/functions/v1/canva-connect/callback", "st", "ch"));
  assertEquals(url.origin + url.pathname, "https://www.canva.com/api/oauth/authorize");
  assertEquals(url.searchParams.get("scope"), "design:meta:read design:content:read");
  assertEquals(url.searchParams.get("code_challenge_method"), "s256");
  assertEquals(url.searchParams.get("state"), "st");
});

Deno.test("callback returns to the app scheme", () => {
  assertEquals(appReturn(), "schwanki://canva/connected");
  assert(appReturn("nope").endsWith("?error=nope"));
});

Deno.test("design summaries tolerate missing fields", () => {
  const d = summarizeDesign({ id: "DAF1", title: " ", updated_at: 1700000000, urls: { view_url: "https://www.canva.com/design/DAF1/view" } });
  assertEquals(d.title, "Untitled design");
  assertEquals(d.updatedAt, "2023-11-14T22:13:20.000Z");
  assertEquals(designRef(d), "https://www.canva.com/design/DAF1/view");
  assertEquals(designRef(summarizeDesign({ id: "DAF2" })), "canva:design:DAF2");
});
