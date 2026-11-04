import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const { signInWithGoogle } = vi.hoisted(() => ({ signInWithGoogle: vi.fn() }));
vi.mock("@/lib/auth", () => ({ signInWithGoogle }));
import SignIn from "./SignIn";
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("keeps the import sign-in available after an OAuth failure", async () => {
  signInWithGoogle.mockRejectedValueOnce(new Error("Connection failed"));
  render(<SignIn />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Connection failed");
  expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveProperty("disabled", false);
});
it("carries the lesson vocabulary from the headline example into the review demo", () => {
  render(<SignIn />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Study what your tutor taught you.");
  const example = screen.getByRole("figure", { name: "One Preply lesson, from PDF to feed" });
  const demo = screen.getByRole("group", { name: "Illustrated Schwanki review demo" });
  const firstWord = demo.querySelector('.hero-feed-slide[aria-hidden="false"] .hero-feed-word')!.textContent!;
  expect(example.textContent).toContain(firstWord);
  expect(screen.getByRole("link", { name: /See it in the demo/ }).getAttribute("href")).toBe("#review-demo");
});
it("keeps imported decks separate from notes awaiting approval", () => {
  render(<SignIn />);
  expect(screen.getByText(/New words wait in your Inbox/)).toBeTruthy();
  expect(screen.getByText(/Import an .apkg or .colpkg export/)).toBeTruthy();
});

it("exposes visual import and note examples as named illustrations", () => {
  render(<SignIn />);
  expect(screen.getByRole("img", { name: /Anki export becomes a Schwanki deck/ })).toBeTruthy();
  expect(screen.getByRole("img", { name: /class notes becoming a vocabulary suggestion/ })).toBeTruthy();
});

it("gives the editorial sentences audio and stops one when another starts", async () => {
  render(<SignIn />);
  const homework = screen.getByRole("button", { name: "Hear the sentence in Chinese homework" });
  const notes = screen.getByRole("button", { name: "Hear the sentence in Chinese notes" });
  const recording = homework.closest(".demo-sentence-audio")!.previousElementSibling as HTMLAudioElement;
  await act(async () => fireEvent.click(homework));
  fireEvent.play(recording);
  expect(screen.getByRole("button", { name: "Pause sentence in Chinese homework" })).toBeTruthy();
  vi.mocked(recording.pause).mockClear();
  await act(async () => fireEvent.click(notes));
  expect(recording.pause).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Hear the sentence in Chinese homework" })).toBeTruthy();
});

it("starts Google sign-in from the header and footer Sign in, not just a jump to the hero", () => {
  signInWithGoogle.mockReturnValue(new Promise(() => {}));
  render(<SignIn />);
  fireEvent.click(screen.getByRole("navigation", { name: "Landing navigation" }).querySelector("button")!);
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  cleanup(); signInWithGoogle.mockClear();
  render(<SignIn />);
  fireEvent.click(screen.getAllByRole("button", { name: "Sign in" }).at(-1)!);
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
});
