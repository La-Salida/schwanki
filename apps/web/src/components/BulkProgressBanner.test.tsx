import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { RunCard, RunDetail } from "@/lib/bulk";

const { pollRunDetail } = vi.hoisted(() => ({ pollRunDetail: vi.fn() }));
vi.mock("@/lib/bulk", () => ({ pollRunDetail, cancelBulk: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  api: { listApiKeyProviders: vi.fn().mockResolvedValue([]), signedMediaUrl: vi.fn().mockResolvedValue("https://img") },
}));
import { BulkProgressBanner } from "./BulkProgressBanner";

afterEach(cleanup);

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
