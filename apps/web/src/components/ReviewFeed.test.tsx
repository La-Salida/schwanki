import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DueCard } from "@schwanki/core";
vi.mock("@/lib/supabase", () => ({ api: { updateCard: vi.fn() }, supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/mnemonic", () => ({ loadCardMedia: vi.fn().mockResolvedValue({ sentence: { text: "这很明显。", translation: "This is obvious." } }) }));
vi.mock("./MakeItMemorable", () => ({ MakeItMemorable: () => null }));
import { ReviewFeed } from "./ReviewFeed";
afterEach(cleanup);

const due: DueCard = { card: { id: "c1", userId: "u1", sourceId: "s1", language: "zh", front: "明显", back: "obvious", createdAt: "2026-04-14T00:00:00Z" }, state: null };

function renderFeed(onRate = vi.fn()) {
  render(<ReviewFeed queue={[due]} done={0} label="Teacher Li · Chinese" cardKey="c1:0" saveError={null} offlineNote={null}
    onRate={onRate} onEdited={vi.fn()} onExit={vi.fn()} />);
  return onRate;
}

it("hides the meaning until the learner asks, and rating keys do nothing before that", () => {
  const onRate = renderFeed();
  expect(screen.queryByText("obvious")).toBeNull();
  fireEvent.keyDown(window, { key: "3" });
  expect(onRate).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: " " });
  expect(screen.getByText("obvious")).toBeTruthy();
});

it("shows the generated sentence and grades from the rating row", async () => {
  const onRate = renderFeed();
  fireEvent.keyDown(window, { key: "Enter" });
  await waitFor(() => expect(screen.getByText("This is obvious.")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /got it/i }));
  expect(onRate).toHaveBeenCalledWith("good");
});

it("treats swipe-up keys like the gesture: first reveal, then Got it", () => {
  const onRate = renderFeed();
  fireEvent.keyDown(window, { key: "ArrowUp" });
  expect(onRate).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "ArrowUp" });
  expect(onRate).toHaveBeenCalledWith("good");
});

it("takes the covered navigation out of the tab order while the feed is open", () => {
  const header = document.createElement("header");
  document.body.prepend(header);
  renderFeed();
  expect(header.inert).toBe(true);
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Back to today");
  cleanup();
  expect(header.inert).toBe(false);
  header.remove();
});
