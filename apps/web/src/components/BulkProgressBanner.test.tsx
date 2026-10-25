import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { RunCard, RunDetail } from "@/lib/bulk";

const { pollRunDetail, enqueueBulk, loadPreviewRest, clearPreviewRest, savePreviewRest } = vi.hoisted(() => ({
  pollRunDetail: vi.fn(), enqueueBulk: vi.fn(), loadPreviewRest: vi.fn(), clearPreviewRest: vi.fn(), savePreviewRest: vi.fn(),
}));
vi.mock("@/lib/bulk", () => ({
  pollRunDetail, enqueueBulk, loadPreviewRest, clearPreviewRest, savePreviewRest, cancelBulk: vi.fn(),
  estimateBulk: (runs: unknown[]) => ({ cards: runs.length, credits: runs.length, freeEverything: false }),
}));
vi.mock("@/lib/supabase", () => ({
  api: { listApiKeyProviders: vi.fn().mockResolvedValue([]), signedMediaUrl: vi.fn().mockResolvedValue("https://img") },
}));
import { BulkProgressBanner } from "./BulkProgressBanner";

afterEach(() => { cleanup(); loadPreviewRest.mockReset(); enqueueBulk.mockReset(); clearPreviewRest.mockReset(); savePreviewRest.mockReset(); });

const card = (over: Partial<RunCard>): RunCard => ({
  jobId: "j", cardId: "c", front: "你好", kinds: ["sentence", "image", "audio"], status: "done", error: null,
  updatedAt: "2026-10-24T12:01:00Z", credits: 1, sentence: { text: "你好吗", translation: "How are you" },
  imagePath: "u/c/g/image.png", audioPath: "u/c/g/audio.mp3", ...over,
});

it("shows what is being made, what each card cost and the run's credit total", async () => {
  const run: RunDetail = {
    progress: { done: 1, failed: 1, queued: 1, active: 1 }, total: 4, startedAt: "2026-10-24T12:00:00Z",
    spent: 1, remainingCredits: 2, minutesLeft: 3,
    running: [card({ jobId: "r", front: "学习", status: "running", credits: null })],
    finished: [card({ jobId: "f", front: "朋友", status: "failed", error: "image failed", credits: null }), card({ jobId: "d" })],
  };
  pollRunDetail.mockResolvedValue(run);
  render(<BulkProgressBanner />);
  expect((await screen.findByRole("status")).textContent).toBe("2 of 4 cards · 1 failed · about 3 min left");
  expect(screen.getByText(/Now making/).parentElement!.textContent).toBe("Now making: 学习 (sentence, picture, audio)");
  expect(screen.getByText("Spent this run").nextElementSibling!.textContent).toBe("1 credit");
  expect(screen.getByText("Still to come").nextElementSibling!.textContent).toBe("up to 2 credits");

  fireEvent.click(screen.getByRole("button", { name: "Show what's been made (2)" }));
  expect(screen.getByText("你好吗")).toBeTruthy();
  expect(screen.getByText(/Failed: image failed/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Play audio for 你好" })).toBeTruthy();
});

it("shows a finished preview's pictures large and queues the held-back cards on request", async () => {
  const rest = [{ cardId: "x", kinds: ["image"] }, { cardId: "y", kinds: ["image"] }];
  loadPreviewRest.mockReturnValue({ queuedAt: 1, rest });
  const run: RunDetail = {
    progress: { done: 1, failed: 0, queued: 0, active: 0 }, total: 1, startedAt: "2026-10-25T05:00:00Z",
    spent: 1, remainingCredits: 0, minutesLeft: 0, running: [], finished: [card({})],
  };
  pollRunDetail.mockResolvedValue(run);
  enqueueBulk.mockResolvedValue(2);
  render(<BulkProgressBanner />);
  expect(await screen.findByText("Preview finished")).toBeTruthy();
  expect(await screen.findByRole("img", { name: "Picture for 你好" })).toBeTruthy();
  // the list of what was made starts open for a preview
  expect(screen.getByRole("button", { name: "Hide what's been made (1)" })).toBeTruthy();
  expect(screen.getByText(/for up to 2 credits/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Make the other 2 cards" }));
  await screen.findByText("Memory aids finished", {}, { timeout: 2000 }).catch(() => undefined);
  expect(enqueueBulk).toHaveBeenCalledWith(rest);
  expect(clearPreviewRest).toHaveBeenCalled();
});

it("keeps only the cards that did not get queued when queueing them partly worked", async () => {
  loadPreviewRest.mockReturnValue({ queuedAt: 1, rest: [{ cardId: "x", kinds: ["image"] }, { cardId: "y", kinds: ["image"] }] });
  pollRunDetail.mockResolvedValue({
    progress: { done: 1, failed: 0, queued: 0, active: 0 }, total: 1, startedAt: "2026-10-25T05:00:00Z",
    spent: 0, remainingCredits: 0, minutesLeft: 0, running: [], finished: [card({ imagePath: null })],
  } satisfies RunDetail);
  enqueueBulk.mockResolvedValue(1);
  render(<BulkProgressBanner />);
  fireEvent.click(await screen.findByRole("button", { name: "Make the other 2 cards" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/Only 1 of 2 cards got queued/);
  expect(clearPreviewRest).not.toHaveBeenCalled();
  // the queued card must never be queued (and billed) again on retry
  expect(savePreviewRest).toHaveBeenCalledWith([{ cardId: "y", kinds: ["image"] }], 1);
  expect(screen.getByRole("button", { name: "Make the other 1 card" })).toBeTruthy();
});

it("drops the held-back cards on Not now", async () => {
  loadPreviewRest.mockReturnValue({ queuedAt: 1, rest: [{ cardId: "x", kinds: ["image"] }] });
  pollRunDetail.mockResolvedValue({
    progress: { done: 1, failed: 0, queued: 0, active: 0 }, total: 1, startedAt: "2026-10-25T05:00:00Z",
    spent: 0, remainingCredits: 0, minutesLeft: 0, running: [], finished: [card({ imagePath: null })],
  } satisfies RunDetail);
  render(<BulkProgressBanner />);
  fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
  expect(clearPreviewRest).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Make the other/ })).toBeNull();
  expect(screen.getByText("Memory aids finished")).toBeTruthy();
});
