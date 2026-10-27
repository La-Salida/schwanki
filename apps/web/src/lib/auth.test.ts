import { describe, it, expect } from "vitest";
import { driveOAuthOptions, GOOGLE_DRIVE_OAUTH_OPTIONS, GOOGLE_SIGN_IN_OPTIONS } from "./auth";

describe("google oauth options", () => {
  it("signs in without asking for Drive, so an unverified restricted scope can't block sign-in", () => {
    expect(GOOGLE_SIGN_IN_OPTIONS.options.scopes).not.toContain("drive");
  });
  it("asks only for picked-file Drive access, with offline access and consent, when connecting Drive", () => {
    expect(GOOGLE_DRIVE_OAUTH_OPTIONS.options.scopes).toContain("https://www.googleapis.com/auth/drive.file");
    expect(GOOGLE_DRIVE_OAUTH_OPTIONS.options.scopes).not.toContain("drive.readonly");
    expect(GOOGLE_DRIVE_OAUTH_OPTIONS.options.queryParams).toEqual({
      access_type: "offline",
      prompt: "consent",
    });
    expect(GOOGLE_DRIVE_OAUTH_OPTIONS.options.redirectTo).toMatch(/\/sources\?drive=pick$/);
    expect(driveOAuthOptions("abc").options.redirectTo).toMatch(/\/sources\?drive=pick&source=abc$/);
  });
});
