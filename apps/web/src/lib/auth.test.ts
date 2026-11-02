import { describe, it, expect } from "vitest";
import { driveOAuthOptions, GOOGLE_DRIVE_OAUTH_OPTIONS, GOOGLE_SIGN_IN_OPTIONS, signInReturnUrl } from "./auth";

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
  it("returns to the extension connect page after signing in from it", () => {
    expect(signInReturnUrl({ origin: "https://schwankiapp.com", pathname: "/extension-auth", search: "?extensionId=abc" }))
      .toBe("https://schwankiapp.com/extension-auth?extensionId=abc");
    expect(signInReturnUrl({ origin: "https://schwankiapp.com", pathname: "/inbox", search: "" })).not.toContain("inbox");
  });
});
