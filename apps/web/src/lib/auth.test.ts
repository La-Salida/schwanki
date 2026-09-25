import { describe, it, expect } from "vitest";
import { GOOGLE_OAUTH_OPTIONS } from "./auth";

describe("google oauth options", () => {
  it("requests drive.readonly with offline access and consent prompt", () => {
    expect(GOOGLE_OAUTH_OPTIONS.options.scopes).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(GOOGLE_OAUTH_OPTIONS.options.queryParams).toEqual({
      access_type: "offline",
      prompt: "consent",
    });
  });
});
