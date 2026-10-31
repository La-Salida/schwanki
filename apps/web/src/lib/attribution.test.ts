import { describe, expect, it } from "vitest";
import { readFirstTouch } from "./attribution";

const now = new Date("2026-11-02T10:00:00Z");

describe("readFirstTouch", () => {
  it("keeps UTM tags, the landing path and an outside referrer", () => {
    const touch = readFirstTouch(
      "https://schwankiapp.com/anki-alternative?utm_source=reddit&utm_medium=post&utm_campaign=r_anki&x=1",
      "https://www.reddit.com/r/Anki/comments/abc/?sort=new", now);
    expect(touch).toEqual({
      utm_source: "reddit", utm_medium: "post", utm_campaign: "r_anki", utm_content: null,
      referrer: "https://www.reddit.com/r/Anki/comments/abc/", landing_path: "/anki-alternative",
      first_seen_at: "2026-11-02T10:00:00.000Z",
    });
  });

  it("treats a ref code as the source when there is no utm_source", () => {
    expect(readFirstTouch("https://schwankiapp.com/?ref=mei-laoshi", "", now).utm_source).toBe("mei-laoshi");
  });

  it("ignores our own pages, Google sign-in and Supabase as referrers", () => {
    for (const ref of ["https://schwankiapp.com/pricing", "https://accounts.google.com/o/oauth2", "https://oiemotutqshdohmfhtdw.supabase.co/auth/v1/callback"]) {
      expect(readFirstTouch("https://schwankiapp.com/", ref, now).referrer).toBeNull();
    }
  });

  it("caps long values", () => {
    const long = "a".repeat(400);
    expect(readFirstTouch(`https://schwankiapp.com/?utm_campaign=${long}`, "", now).utm_campaign).toHaveLength(200);
  });
});
