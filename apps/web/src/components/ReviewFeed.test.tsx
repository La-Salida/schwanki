import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DueCard } from "@schwanki/core";
vi.mock("@/lib/supabase", () => ({ api: { updateCard: vi.fn() }, supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/mnemonic", () => ({ loadCardMedia: vi.fn().mockResolvedValue({ sentence: { text: "这很明显。", translation: "This is obvious." } }) }));
vi.mock("./MakeItMemorable", () => ({ MakeItMemorable: () => null }));
import { ReviewFeed } from "./ReviewFeed";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

it("keeps ratings visible but disabled until recall, with an accessible reveal button", () => {
  const onRate = renderFeed();
  const good = screen.getByRole("button", { name: /got it/i }) as HTMLButtonElement;
  expect(good.disabled || good.closest("fieldset")?.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  expect(good.closest("fieldset")?.disabled).toBe(false);
  expect(onRate).not.toHaveBeenCalled();
});

it("reveals on scroll, ignores momentum, and rates only on a fresh scroll gesture", () => {
  let time = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const onRate = renderFeed();
  const surface = document.querySelector(".feed-card")!;
  fireEvent.wheel(surface, { deltaY: 100 });
  expect(screen.getByText("obvious")).toBeTruthy();
  time += 100;
  fireEvent.wheel(surface, { deltaY: 150 });
  expect(onRate).not.toHaveBeenCalled();
  time += 800;
  fireEvent.wheel(surface, { deltaY: 100 });
  expect(onRate).toHaveBeenCalledExactlyOnceWith("good");
});

it("ignores held rating keys and supports shortcuts with the exit button focused", () => {
  const onRate = renderFeed();
  const exit = screen.getByRole("button", { name: "Back to today" });
  fireEvent.keyDown(exit, { key: "ArrowUp" });
  fireEvent.keyDown(exit, { key: "ArrowUp", repeat: true });
  expect(onRate).not.toHaveBeenCalled();
  fireEvent.keyDown(exit, { key: "3" });
  expect(onRate).toHaveBeenCalledExactlyOnceWith("good");
});

it("does not let momentum reveal or rate the next scheduled card", () => {
  let time = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const onRate = vi.fn();
  const props = { queue: [due], done: 0, label: "Today", cardKey: "c1:0", saveError: null, offlineNote: null, onRate, onEdited: vi.fn(), onExit: vi.fn() };
  const { rerender } = render(<ReviewFeed {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  fireEvent.wheel(document.querySelector(".feed-card")!, { deltaY: 100 });
  expect(onRate).toHaveBeenCalledExactlyOnceWith("good");
  rerender(<ReviewFeed {...props} cardKey="c1:1" done={1} />);
  time += 100;
  fireEvent.wheel(document.querySelector(".feed-card")!, { deltaY: 150 });
  expect(screen.queryByText("obvious")).toBeNull();
  expect(onRate).toHaveBeenCalledTimes(1);
  time += 800;
  fireEvent.wheel(document.querySelector(".feed-card")!, { deltaY: 100 });
  expect(screen.getByText("obvious")).toBeTruthy();
  expect(onRate).toHaveBeenCalledTimes(1);
});

it("scrolls long content first and advances with a fresh gesture at its boundary", () => {
  let time = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const onRate = renderFeed();
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  const body = document.querySelector<HTMLElement>(".feed-body")!;
  Object.defineProperties(body, { scrollHeight: { value: 500 }, clientHeight: { value: 100 } });
  fireEvent.wheel(body, { deltaY: 100 });
  expect(onRate).not.toHaveBeenCalled();
  body.scrollTop = 400;
  time += 100;
  fireEvent.wheel(body, { deltaY: 100 });
  expect(onRate).not.toHaveBeenCalled();
  time += 800;
  fireEvent.wheel(body, { deltaY: 100 });
  expect(onRate).toHaveBeenCalledExactlyOnceWith("good");
});

it("allows horizontal ratings on long content and vertical ratings at its boundary", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const onRate = renderFeed();
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  const body = document.querySelector<HTMLElement>(".feed-body")!;
  Object.defineProperties(body, { scrollHeight: { value: 500 }, clientHeight: { value: 100 } });
  fireEvent.pointerDown(body, { clientX: 100, clientY: 200 });
  fireEvent.pointerMove(body, { clientX: 200, clientY: 200 });
  fireEvent.pointerUp(body, { clientX: 200, clientY: 200 });
  expect(onRate).toHaveBeenLastCalledWith("easy");
  onRate.mockClear();
  fireEvent.pointerDown(body, { clientX: 100, clientY: 200 });
  fireEvent.pointerMove(body, { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(body, { clientX: 100, clientY: 100 });
  expect(body.scrollTop).toBe(100);
  expect(onRate).not.toHaveBeenCalled();
  body.scrollTop = 400;
  fireEvent.pointerDown(body, { clientX: 100, clientY: 200 });
  fireEvent.pointerMove(body, { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(body, { clientX: 100, clientY: 100 });
  expect(onRate).toHaveBeenCalledExactlyOnceWith("good");
});
