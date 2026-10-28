import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LandingFeed from "./LandingFeed";
import { FEED_CARDS } from "@/lib/feedCards";
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next demo step" }));
it("preserves the word, reveals before advancing, and ends the queue", () => {
  render(<LandingFeed />);
  expect(document.querySelector(".hero-classic")?.getAttribute("aria-hidden")).toBe("true");
  const first = document.querySelector(".hero-feed-slide");
  expect(first?.querySelector(".hero-feed-word")?.textContent).toBe("偷");
  expect(first?.getAttribute("aria-hidden")).toBe("false");
  expect(first?.querySelector(".hero-feed-answer")?.getAttribute("data-revealed")).toBe("false");
  next();
  expect(first?.querySelector(".hero-feed-answer")?.getAttribute("data-revealed")).toBe("true");
  next();
  expect(document.querySelectorAll(".hero-feed-slide")[1]?.getAttribute("aria-hidden")).toBe("false");
  next(); next(); next();
  expect(screen.getByRole("heading", { name: "That’s the feed." })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next demo step" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Previous demo step" }));
  expect(screen.queryByRole("heading", { name: "That’s the feed." })).toBeNull();
});
it("uses page scroll to change stages and cleans up its listeners", () => {
  let callback: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { callback = cb; return 1; });
  const remove = vi.spyOn(window, "removeEventListener");
  const view = render(<LandingFeed />);
  const section = document.querySelector(".landing-scroll-hero")!;
  Object.defineProperty(section, "offsetHeight", { value: window.innerHeight + 1400 });
  vi.spyOn(section, "getBoundingClientRect").mockReturnValue({ top: -560 } as DOMRect);
  fireEvent.scroll(window);
  act(() => callback?.(0));
  expect(screen.getByText("Got it. Next word.")).toBeTruthy();
  view.unmount();
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
});
it("offers manual steps and still images for reduced motion", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("prefers-reduced-motion"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<LandingFeed />);
  next(); next(); next();
  expect(screen.getByText(/Use the arrows/)).toBeTruthy();
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});
it("pauses scenes and falls back to a poster when media fails", () => {
  render(<LandingFeed />);
  fireEvent.click(screen.getByRole("button", { name: "Pause scenes" }));
  expect(screen.getByRole("button", { name: "Scenes paused" })).toBeTruthy();
  fireEvent.error(document.querySelector(".hero-feed-slide video")!);
  expect(document.querySelector(".hero-feed-slide img")?.getAttribute("src")).toBe("/demo/goose-steals-homework.jpg");
});

it("leads with Schwanki and only shows traditional review when explicitly compared", () => {
  render(<LandingFeed />);
  const classic = document.querySelector(".hero-classic");
  expect(classic?.getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Compare with Anki ↔" }));
  expect(classic?.getAttribute("aria-hidden")).toBe("false");
  expect(classic?.querySelector(".classic-word")?.textContent).toBe("偷");
  fireEvent.click(screen.getByRole("button", { name: "Back to Schwanki" }));
  expect(classic?.getAttribute("aria-hidden")).toBe("true");
  next(); next();
  fireEvent.click(screen.getByRole("button", { name: "Compare with Anki ↔" }));
  expect(classic?.querySelector(".classic-word")?.textContent).toBe("逃げる");
  next();
  expect(classic?.getAttribute("aria-hidden")).toBe("true");
});

it.each([1, 2, 6])("reviews every card and finishes for a %i-card demo", (count) => {
  const cards = Array.from({ length: count }, (_, i) => ({ ...FEED_CARDS[i % FEED_CARDS.length]!, id: `sample-${i}`, word: `word-${i}` }));
  render(<LandingFeed cards={cards} />);
  next();
  for (let i = 0; i < cards.length; i++) {
    const shown = document.querySelector('.hero-feed-slide[aria-hidden="false"]');
    expect(shown?.querySelector(".hero-feed-word")?.textContent).toBe(`word-${i}`);
    expect(screen.queryByRole("heading", { name: "That’s the feed." })).toBeNull();
    expect(document.querySelector(".hero-demo-caption")?.textContent).not.toBe("");
    next();
  }
  expect(screen.getByRole("heading", { name: "That’s the feed." })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next demo step" })).toHaveProperty("disabled", true);
});

it("keeps short windows manually navigable without programmatic scrolling", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-height"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<LandingFeed />);
  next();
  expect(screen.getByText(/Use the arrows/)).toBeTruthy();
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(document.querySelector('.hero-feed-slide[aria-hidden="false"] .hero-feed-answer')?.getAttribute("data-revealed")).toBe("true");
});

it("offers each sentence recording only after reveal and never autoplays audio", async () => {
  render(<LandingFeed />);
  expect(document.querySelectorAll("audio")).toHaveLength(FEED_CARDS.length);
  expect(screen.queryByRole("button", { name: /Hear the sentence in / })).toBeNull();
  for (const card of FEED_CARDS) {
    next();
    const button = screen.getByRole("button", { name: `Hear the sentence in ${card.language}` });
    const audio = document.querySelector<HTMLAudioElement>('.hero-feed-slide[aria-hidden="false"] audio')!;
    expect(audio.getAttribute("src")).toBe(card.audio);
    expect(audio.autoplay).toBe(false);
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.instances.filter(el => el instanceof HTMLAudioElement)).toHaveLength(0);
    await act(async () => fireEvent.click(button));
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.instances).toContain(audio);
    fireEvent.play(audio);
    expect(screen.getByRole("button", { name: `Pause sentence in ${card.language}` })).toBeTruthy();
    fireEvent.ended(audio);
    expect(screen.getByRole("button", { name: `Hear the sentence in ${card.language}` })).toBeTruthy();
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
  }
});

it("stops sentence audio on navigation, comparison, hidden tabs and unmount", async () => {
  const view = render(<LandingFeed />);
  next();
  const audio = document.querySelector<HTMLAudioElement>('.hero-feed-slide[aria-hidden="false"] audio')!;
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Hear the sentence in Chinese" })));
  fireEvent.play(audio);
  fireEvent.click(screen.getByRole("button", { name: "Pause sentence in Chinese" }));
  expect(audio.pause).toHaveBeenCalled();
  fireEvent.pause(audio);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Hear the sentence in Chinese" })));
  vi.mocked(audio.pause).mockClear();
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  fireEvent(document, new Event("visibilitychange"));
  expect(audio.pause).toHaveBeenCalled();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  vi.mocked(audio.pause).mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Compare with Anki ↔" }));
  expect(audio.pause).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Hear the sentence in / })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Back to Schwanki" }));
  audio.currentTime = 1;
  next();
  expect(audio.currentTime).toBe(0);
  vi.mocked(audio.pause).mockClear();
  view.unmount();
  expect(audio.pause).toHaveBeenCalled();
});

it("keeps audio available with reduced motion and permits retry after playback failure", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<LandingFeed />);
  next();
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("Network error"));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Hear the sentence in Chinese" })));
  expect(screen.getByRole("status").textContent).toContain("Couldn’t play");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Hear the sentence in Chinese" })));
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
});

it("clears a failed recording when leaving an example and includes visible text in its accessible name", async () => {
  render(<LandingFeed />);
  next();
  const button = screen.getByRole("button", { name: "Hear the sentence in Chinese" });
  expect(button.getAttribute("aria-label")).toContain(button.textContent);
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("Network error"));
  await act(async () => fireEvent.click(button));
  expect(screen.getByRole("status")).toBeTruthy();
  next();
  fireEvent.click(screen.getByRole("button", { name: "Previous demo step" }));
  expect(screen.queryByRole("status")).toBeNull();
});
