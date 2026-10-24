import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReviewDisplaySettings } from "./ReviewDisplaySettings";
import { readReviewDisplay } from "@/lib/reviewDisplay";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it("saves a preset, custom side choices and autoplay, then restores them", () => {
  render(<ReviewDisplaySettings />);
  fireEvent.change(screen.getByLabelText("Start with"), { target: { value: "image" } });
  fireEvent.change(screen.getByLabelText("Meaning"), { target: { value: "prompt" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Play audio automatically/ }));
  expect(readReviewDisplay()).toMatchObject({ fields: { word: "answer", meaning: "prompt", image: "both" }, autoplay: false });
  cleanup();
  render(<ReviewDisplaySettings />);
  expect((screen.getByLabelText("Meaning") as HTMLSelectElement).value).toBe("prompt");
  expect((screen.getByLabelText("Start with") as HTMLSelectElement).value).toBe("custom");
  expect((screen.getByRole("checkbox", { name: /Play audio automatically/ }) as HTMLInputElement).checked).toBe(false);
});

it("applies settings even if storage is full and explains that they are temporary", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  render(<ReviewDisplaySettings />);
  fireEvent.change(screen.getByLabelText("Start with"), { target: { value: "audio" } });
  expect((screen.getByLabelText("Word") as HTMLSelectElement).value).toBe("answer");
  expect(screen.getByRole("status").textContent).toContain("Applied for now");
});
