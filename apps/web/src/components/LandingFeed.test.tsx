import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import LandingFeed from "./LandingFeed";
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
  fireEvent.click(screen.getByRole("button", { name: "Back to Schwanki ↗" }));
  expect(classic?.getAttribute("aria-hidden")).toBe("true");
  next(); next();
  fireEvent.click(screen.getByRole("button", { name: "Compare with Anki ↔" }));
  expect(classic?.querySelector(".classic-word")?.textContent).toBe("逃げる");
  next();
  expect(classic?.getAttribute("aria-hidden")).toBe("true");
});
