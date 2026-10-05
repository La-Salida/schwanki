import { describe, it, expect } from "vitest";
import { flagFor, timeAgo, SOURCE_ICON } from "./meta";

describe("flagFor", () => {
  it("maps common languages case-insensitively, falls back to 🌐", () => {
    expect(flagFor("zh")).toBe("🇨🇳");
    expect(flagFor("ZH-TW")).toBe("🇹🇼");
    expect(flagFor("ko")).toBe("🇰🇷");
    expect(flagFor("xx")).toBe("🌐");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  it("formats minute/hour/day scales", () => {
    expect(timeAgo("2026-10-01T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-01T11:45:00Z", now)).toBe("15m ago");
    expect(timeAgo("2026-10-01T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo("2026-09-28T12:00:00Z", now)).toBe("3d ago");
  });
  it("falls back to the ISO date beyond 30d and for garbage", () => {
    expect(timeAgo("2026-01-01T00:00:00Z", now)).toBe("2026-01-01");
    expect(timeAgo("not-a-date", now)).toBe("not-a-date");
  });
});

describe("SOURCE_ICON", () => {
  it("covers every source type", () => {
    expect(Object.keys(SOURCE_ICON).sort()).toEqual(["class_recording", "google_doc", "google_sheet", "manual", "pdf_upload", "preply_chat"]);
  });
});
