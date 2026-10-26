import { describe, it, expect } from "vitest";
import { GOOGLE_DRIVE_OAUTH_OPTIONS, GOOGLE_SIGN_IN_OPTIONS } from "./auth";

describe("google oauth options", () => {
  it("signs in without asking for Drive, so an unverified restricted scope can't block sign-in", () => {
    expect(GOOGLE_SIGN_IN_OPTIONS.options.scopes).not.toContain("drive");
  });
  it("asks for drive.readonly with offline access and consent only when connecting Drive", () => {
    expect(GOOGLE_DRIVE_OAUTH_OPTIONS.options.scopes).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(GOOGLE_DRIVE_OAUTH_OPTIONS.options.queryParams).toEqual({
      access_type: "offline",
      prompt: "consent",
    });
  });
});
