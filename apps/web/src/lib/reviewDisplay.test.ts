import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_REVIEW_DISPLAY, readReviewDisplay, REVIEW_DISPLAY_KEY, shownOn } from "./reviewDisplay";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it("uses image-and-word-first defaults for absent or malformed preferences", () => {
  expect(readReviewDisplay()).toEqual(DEFAULT_REVIEW_DISPLAY);
  localStorage.setItem(REVIEW_DISPLAY_KEY, "broken JSON");
  expect(readReviewDisplay()).toEqual(DEFAULT_REVIEW_DISPLAY);
});

it("restores valid choices and repairs invalid fields individually", () => {
  localStorage.setItem(REVIEW_DISPLAY_KEY, JSON.stringify({ fields: { word: "hidden", image: "prompt", meaning: "invalid" }, autoplay: false }));
  const display = readReviewDisplay();
  expect(display.fields.word).toBe("hidden");
  expect(display.fields.image).toBe("prompt");
  expect(display.fields.meaning).toBe("answer");
  expect(display.autoplay).toBe(false);
});

it("keeps review available when browser storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(readReviewDisplay()).toEqual(DEFAULT_REVIEW_DISPLAY);
});

it.each([
  ["prompt", true, false], ["answer", false, true], ["both", true, true], ["hidden", false, false],
] as const)("shows %s on the selected sides only", (side, prompt, answer) => {
  expect(shownOn(side, false)).toBe(prompt);
  expect(shownOn(side, true)).toBe(answer);
});
