import { describe, expect, it } from "vitest";
import type { Source, SourceSyncProgress } from "@schwanki/core";
import { rowSync } from "./syncProgress";

const source = (over: Partial<Source> = {}): Source => ({
  id: "s1", userId: "u1", type: "pdf_upload", externalRef: "x", label: "Notes", language: "zh",
  status: "active", lastSyncedAt: "2026-10-14T07:00:00Z", ...over,
});
const progress = (over: Partial<SourceSyncProgress> = {}): SourceSyncProgress => ({
  sourceId: "s1", syncing: false, parseStatus: null, ...over,
});

describe("rowSync", () => {
  it("shows a sync this page started before the server reports it", () => {
    expect(rowSync(source(), undefined, true).phase).toBe("syncing");
  });

  it("shows a scheduled sync the server is running", () => {
    expect(rowSync(source(), progress({ syncing: true }), false).phase).toBe("syncing");
  });

  it("shows parsing while the words are queued or being read", () => {
    expect(rowSync(source(), progress({ parseStatus: "pending" }), false)).toMatchObject({ phase: "parsing", text: expect.stringContaining("Waiting") });
    expect(rowSync(source(), progress({ parseStatus: "running" }), false)).toMatchObject({ phase: "parsing", text: expect.stringContaining("Reading") });
  });

  it("reports the word count when the parse finished after the latest sync", () => {
    const done = progress({ parseStatus: "done", wordsFound: 12, parseFinishedAt: "2026-10-14T07:01:00Z" });
    expect(rowSync(source(), done, false).text).toMatch(/12 new words sent to the Inbox$/);
    expect(rowSync(source(), { ...done, wordsFound: 1 }, false).text).toMatch(/1 new word sent/);
    expect(rowSync(source(), { ...done, wordsFound: 0 }, false).text).toMatch(/no new words$/);
  });

  it("drops an old word count once a later sync found nothing to parse", () => {
    const old = progress({ parseStatus: "done", wordsFound: 12, parseFinishedAt: "2026-10-13T07:01:00Z" });
    expect(rowSync(source(), old, false).text).not.toMatch(/word/);
  });

  it("shows the error and revoked states", () => {
    expect(rowSync(source({ status: "error", errorDetail: "drive export 500" }), undefined, false))
      .toMatchObject({ tone: "alert", text: expect.stringContaining("drive export 500") });
    expect(rowSync(source({ status: "revoked" }), progress({ syncing: true }), false).text).toMatch(/Reconnect Google/);
  });
});
