import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import LandingFeed from "./LandingFeed";
import { FEED_CARDS } from "@/lib/feedCards";
afterEach(cleanup);
it("shows one goose card per language with the target word highlighted", () => {
  render(<LandingFeed />);
  expect(FEED_CARDS.map((c) => c.id)).toEqual(["zh", "ja", "es", "ru"]);
  const slides = document.querySelectorAll(".feed-slide");
  expect(slides).toHaveLength(4);
  const highlighted = Array.from(slides).map((s) => s.querySelector(".feed-sentence mark")?.textContent);
  expect(highlighted).toEqual(["偷", "逃げた", "chamba", "съел"]);
  expect(slides[0]?.getAttribute("aria-hidden")).toBe("false");
  expect(slides[1]?.getAttribute("aria-hidden")).toBe("true");
});
