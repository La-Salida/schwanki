import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DueCard } from "@schwanki/core";
vi.mock("@/lib/supabase", () => ({ api: { updateCard: vi.fn() }, supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/mnemonic", () => ({ loadCardMedia: vi.fn().mockResolvedValue({ imageUrl: "/helper.jpg", audioUrl: "/voice.mp3", sentence: { text: "这很明显。", translation: "This is obvious." } }) }));
vi.mock("./MakeItMemorable", () => ({ MakeItMemorable: () => null }));
import { ReviewFeed } from "./ReviewFeed";
import { loadCardMedia } from "@/lib/mnemonic";
import { REVIEW_DISPLAY_KEY, REVIEW_PRESETS } from "@/lib/reviewDisplay";
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const due: DueCard = { card: { id: "c1", userId: "u1", sourceId: "s1", language: "zh", front: "明显", back: "obvious", createdAt: "2026-04-14T00:00:00Z" }, state: null };

function choosePreset(id: string) {
  localStorage.setItem(REVIEW_DISPLAY_KEY, JSON.stringify(REVIEW_PRESETS.find(p => p.id === id)!.display));
}

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

it("shows the helper image before reveal by default at desktop width", async () => {
  vi.stubGlobal("innerWidth", 1440);
  const onRate = renderFeed();
  await waitFor(() => expect(document.querySelector(".feed-image")?.getAttribute("src")).toBe("/helper.jpg"));
  expect(screen.queryByText("obvious")).toBeNull();
  const surface = document.querySelector(".feed-card")!;
  fireEvent.wheel(surface, { deltaY: 100 });
  expect(screen.getByText("obvious")).toBeTruthy();
  expect(onRate).not.toHaveBeenCalled();
});

it("supports word-first with image and meaning reserved for reveal", async () => {
  choosePreset("word");
  renderFeed();
  await waitFor(() => expect(loadCardMedia).toHaveBeenCalled());
  expect(document.querySelector(".feed-word")?.textContent).toBe("明显");
  expect(document.querySelector(".feed-image")).toBeNull();
  expect(screen.queryByText("obvious")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  await waitFor(() => expect(document.querySelector(".feed-image")).toBeTruthy());
  expect(screen.getByText("obvious")).toBeTruthy();
});

it("supports audio-first without leaking the word or answer into visible or accessible text", async () => {
  choosePreset("audio");
  renderFeed();
  expect(screen.queryByText("明显")).toBeNull();
  expect(screen.queryByText("obvious")).toBeNull();
  expect(screen.queryByLabelText(/明显/)).toBeNull();
  expect(document.querySelector(".feed-image")).toBeNull();
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "Play audio" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  expect(document.querySelector(".feed-word")?.textContent).toBe("明显");
  expect(screen.getByText("obvious")).toBeTruthy();
});

it("applies display changes from the feed without rating or losing the card", async () => {
  const onRate = renderFeed();
  fireEvent.click(screen.getByRole("button", { name: "Review display" }));
  fireEvent.change(screen.getByLabelText("Start with"), { target: { value: "meaning" } });
  fireEvent.keyDown(window, { key: "3" });
  expect(onRate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByText("obvious")).toBeTruthy();
  expect(screen.queryByText("明显")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  expect(document.querySelector(".feed-word")?.textContent).toBe("明显");
  expect(onRate).not.toHaveBeenCalled();
});

it("keeps the original word in the memory editor and blocks background review actions", async () => {
  const onRate = renderFeed();
  fireEvent.keyDown(window, { key: "Enter" });
  const opener = await screen.findByRole("button", { name: /Make it (more )?memorable/ });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Make it memorable" });
  expect(within(dialog).getByText("明显")).toBeTruthy();
  expect(within(dialog).getByText("obvious")).toBeTruthy();
  fireEvent.keyDown(window, { key: "3" });
  fireEvent.wheel(document.querySelector(".feed-card")!, { deltaY: 150 });
  expect(onRate).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Back to review" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

it("keeps missing audio prompts private and offers reveal as a way forward", async () => {
  choosePreset("audio");
  vi.mocked(loadCardMedia).mockResolvedValueOnce({});
  renderFeed();
  expect(await screen.findByText(/No content for this display choice/)).toBeTruthy();
  expect(screen.queryByText("明显")).toBeNull();
  expect(screen.queryByText("obvious")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  expect(screen.getByText("obvious")).toBeTruthy();
});

it("shows a replay control when an audio-first prompt cannot autoplay", async () => {
  choosePreset("audio");
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("autoplay blocked"));
  renderFeed();
  expect(await screen.findByText(/Audio couldn’t play automatically/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Play audio" })).toBeTruthy();
  expect(screen.queryByText("obvious")).toBeNull();
});

it("can mute an audio-first prompt before revealing any written answer", async () => {
  choosePreset("audio");
  const onRate = renderFeed();
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Turn autoplay sound off" }));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  expect(localStorage.getItem("schwanki.feedMuted")).toBe("1");
  expect(screen.queryByText("obvious")).toBeNull();
  expect(onRate).not.toHaveBeenCalled();
});

it("can pause manually played audio while the answer stays hidden", async () => {
  choosePreset("audio");
  renderFeed();
  await screen.findByRole("button", { name: "Play audio" });
  fireEvent.play(document.querySelector("audio")!);
  fireEvent.click(screen.getByRole("button", { name: "Pause audio" }));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  expect(screen.queryByText("obvious")).toBeNull();
});

it.each(["display", "memory"])("restores page scrolling when navigating away with the %s dialog open", async dialog => {
  const before = document.body.style.overflow;
  document.body.style.overflow = "auto";
  renderFeed();
  if (dialog === "display") fireEvent.click(screen.getByRole("button", { name: "Review display" }));
  else {
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: /Make it (more )?memorable/ }));
  }
  expect(document.body.style.overflow).toBe("hidden");
  cleanup();
  expect(document.body.style.overflow).toBe("auto");
  document.body.style.overflow = before;
});

it("shows the generated sentence and grades from the rating row", async () => {
  const onRate = renderFeed();
  fireEvent.keyDown(window, { key: "Enter" });
  await waitFor(() => expect(screen.getByText("This is obvious.")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /got it/i }));
  expect(onRate).toHaveBeenCalledWith("good");
});

it("treats the up arrow like the swipe: it reveals, and never grades", () => {
  const onRate = renderFeed();
  fireEvent.keyDown(window, { key: "ArrowUp" });
  expect(screen.getByText("obvious")).toBeTruthy();
  fireEvent.keyDown(window, { key: "ArrowUp" });
  expect(onRate).not.toHaveBeenCalled();
});

it("hides the reading until the card is revealed", () => {
  render(<ReviewFeed queue={[{ ...due, card: { ...due.card, reading: "míngxiǎn" } }]} done={0} label="All" cardKey="c1:0" saveError={null} offlineNote={null}
    onRate={vi.fn()} onEdited={vi.fn()} onExit={vi.fn()} />);
  expect(screen.queryByText("míngxiǎn")).toBeNull();
  fireEvent.keyDown(window, { key: " " });
  expect(screen.getByText("míngxiǎn")).toBeTruthy();
});

it("moves an old saved display that showed the reading up front to answer-only, keeping other choices", () => {
  localStorage.setItem("schwanki.reviewDisplay.v1", JSON.stringify({ fields: { word: "both", reading: "both", image: "answer" }, autoplay: false }));
  render(<ReviewFeed queue={[{ ...due, card: { ...due.card, reading: "míngxiǎn" } }]} done={0} label="All" cardKey="c1:0" saveError={null} offlineNote={null}
    onRate={vi.fn()} onEdited={vi.fn()} onExit={vi.fn()} />);
  expect(screen.queryByText("míngxiǎn")).toBeNull();
  expect(document.querySelector(".feed-word")?.textContent).toBe("明显");
});

it("celebrates a known word with confetti, and a forgotten one gets a Forgot stamp with no confetti", () => {
  const onRate = renderFeed();
  fireEvent.keyDown(window, { key: " " });
  fireEvent.click(screen.getByRole("button", { name: "Got it →" }));
  expect(document.querySelectorAll(".rating-burst-knew .burst-confetti").length).toBeGreaterThan(10);
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  expect(document.querySelector(".rating-burst-knew")).toBeNull();
  expect(document.querySelector(".rating-burst-forgot .burst-forgot-stamp")).toBeTruthy();
  expect(document.querySelector(".burst-confetti")).toBeNull();
  expect(onRate.mock.calls.map((c) => c[0])).toEqual(["good", "again"]);
});

it("skips the celebration for people who prefer reduced motion", () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
  const onRate = renderFeed();
  fireEvent.keyDown(window, { key: " " });
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(onRate).toHaveBeenCalledWith("good");
  expect(document.querySelector(".rating-burst")).toBeNull();
});

it("takes the covered navigation out of the tab order while the feed is open", () => {
  const header = document.createElement("header");
  document.body.prepend(header);
  renderFeed();
  expect(header.inert).toBe(true);
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Review: Teacher Li · Chinese");
  cleanup();
  expect(header.inert).toBe(false);
  header.remove();
});

it("shows one move at a time: a swipe-up reveal button first, then Forgot and Got it", () => {
  const onRate = renderFeed();
  expect(screen.queryByRole("button", { name: /got it/i })).toBeNull();
  expect(screen.getByText("Swipe up to reveal")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  expect(screen.queryByText("Swipe up to reveal")).toBeNull();
  expect(screen.getByRole("button", { name: "← Forgot" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Got it →" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /hard|easy/i })).toBeNull();
  expect(onRate).not.toHaveBeenCalled();
});

it("starts a swipe up on the reveal button itself", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  renderFeed();
  const button = screen.getByRole("button", { name: "Show meaning of 明显" });
  fireEvent.pointerDown(button, { clientX: 200, clientY: 700 });
  fireEvent.pointerMove(button, { clientX: 200, clientY: 560 });
  fireEvent.pointerUp(button, { clientX: 200, clientY: 560 });
  expect(screen.getByText("obvious")).toBeTruthy();
});

it("reveals on scroll but never grades from a scroll", () => {
  let time = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const onRate = renderFeed();
  const surface = document.querySelector(".feed-card")!;
  fireEvent.wheel(surface, { deltaY: 100 });
  expect(screen.getByText("obvious")).toBeTruthy();
  time += 100;
  fireEvent.wheel(surface, { deltaY: 150 });
  time += 800;
  fireEvent.wheel(surface, { deltaY: 100 });
  expect(onRate).not.toHaveBeenCalled();
});

it("ignores held rating keys and supports shortcuts with the exit button focused", () => {
  const onRate = renderFeed();
  const exit = screen.getByRole("button", { name: "Close review" });
  fireEvent.keyDown(exit, { key: "ArrowUp" });
  fireEvent.keyDown(exit, { key: "ArrowRight", repeat: true });
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
  fireEvent.wheel(document.querySelector(".feed-card")!, { deltaY: 100 });
  expect(screen.getByText("obvious")).toBeTruthy();
  fireEvent.keyDown(window, { key: "ArrowRight" });
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

it("lets long content scroll with the wheel after the reveal", () => {
  const onRate = renderFeed();
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  const body = document.querySelector<HTMLElement>(".feed-body")!;
  Object.defineProperties(body, { scrollHeight: { value: 500 }, clientHeight: { value: 100 } });
  const scroll = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
  body.dispatchEvent(scroll);
  expect(scroll.defaultPrevented).toBe(false);
  expect(onRate).not.toHaveBeenCalled();
});

it("allows horizontal ratings on long content, and vertical drags there only scroll", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const onRate = renderFeed();
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  const body = document.querySelector<HTMLElement>(".feed-body")!;
  Object.defineProperties(body, { scrollHeight: { value: 500 }, clientHeight: { value: 100 } });
  fireEvent.pointerDown(body, { clientX: 100, clientY: 200 });
  fireEvent.pointerMove(body, { clientX: 200, clientY: 200 });
  fireEvent.pointerUp(body, { clientX: 200, clientY: 200 });
  expect(onRate).toHaveBeenLastCalledWith("good");
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
  expect(onRate).not.toHaveBeenCalled();
});

it("rates by swipe: right Got it, left Forgot, vertical nothing, with a live label", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const onRate = renderFeed();
  fireEvent.click(screen.getByRole("button", { name: "Show meaning of 明显" }));
  const surface = document.querySelector<HTMLElement>(".feed-card")!;
  const swipe = (dx: number, dy: number, check?: () => void) => {
    fireEvent.pointerDown(surface, { clientX: 300, clientY: 400 });
    fireEvent.pointerMove(surface, { clientX: 300 + dx, clientY: 400 + dy });
    check?.();
    fireEvent.pointerUp(surface, { clientX: 300 + dx, clientY: 400 + dy });
  };
  swipe(150, 0, () => expect(document.querySelector(".feed-hint")?.getAttribute("data-rating")).toBe("good"));
  swipe(-150, 0, () => {
    expect(screen.getByRole("button", { name: "← Forgot" }).hasAttribute("data-pending")).toBe(true);
    expect(document.querySelector(".feed-swipe-tint")?.getAttribute("data-side")).toBe("again");
  });
  swipe(0, -260, () => expect(document.querySelector(".feed-hint")?.textContent).toBe("Swipe left or right"));
  swipe(0, 260);
  expect(onRate.mock.calls.map((c) => c[0])).toEqual(["good", "again"]);
});

it("maps arrow keys to the swipes and shows Anki-style counts for what's left", () => {
  const learning: DueCard = { card: { ...due.card, id: "c2" }, state: { cardId: "c2", dueAt: "2026-04-14T00:00:00Z", stability: 1, difficulty: 5, reps: 1, lapses: 0, fsrs: { state: 1 } } };
  const onRate = vi.fn();
  render(<ReviewFeed queue={[due, learning]} done={0} label="All" cardKey="c1:0" saveError={null} offlineNote={null}
    onRate={onRate} onEdited={vi.fn()} onExit={vi.fn()} />);
  expect(screen.getByRole("img", { name: "1 new, 1 learning, 0 review" })).toBeTruthy();
  expect(document.querySelector(".due-count-new")?.hasAttribute("data-current")).toBe(true);
  fireEvent.keyDown(window, { key: " " });
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(onRate.mock.calls.map((c) => c[0])).toEqual(["again", "good"]);
});
