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
  fireEvent.click(screen.getByRole("button", { name: "Bring your Anki deck" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Connection failed");
  expect(screen.getByRole("button", { name: "Bring your Anki deck" })).toHaveProperty("disabled", false);
});
it("puts the before/after demonstration inside the headline hero", () => {
  render(<SignIn />);
  const hero = screen.getByRole("region", { name: /Doomscroll\s*your vocab\./ });
  expect(hero.contains(screen.getByRole("group", { name: "Illustrated Anki-to-Schwanki review demo" }))).toBe(true);
  expect(screen.getByText("10 free AI credits · Continue with Google")).toBeTruthy();
});
it("keeps imported decks separate from notes awaiting approval", () => {
  render(<SignIn />);
  expect(screen.getByText(/Anki imports go straight to your deck/)).toBeTruthy();
  expect(screen.getByText(/Import an .apkg or .colpkg export/)).toBeTruthy();
});

it("exposes visual import and note examples as named illustrations", () => {
  render(<SignIn />);
  expect(screen.getByRole("img", { name: /Anki export becomes a Schwanki deck/ })).toBeTruthy();
  expect(screen.getByRole("img", { name: /class notes becoming a vocabulary suggestion/ })).toBeTruthy();
});

it("gives the editorial sentences audio and stops one when another starts", async () => {
  render(<SignIn />);
  const homework = screen.getByRole("button", { name: "Play Chinese homework sentence" });
  const notes = screen.getByRole("button", { name: "Play Chinese notes sentence" });
  const recording = homework.closest(".demo-sentence-audio")!.previousElementSibling as HTMLAudioElement;
  await act(async () => fireEvent.click(homework));
  fireEvent.play(recording);
  expect(screen.getByRole("button", { name: "Pause Chinese homework sentence" })).toBeTruthy();
  vi.mocked(recording.pause).mockClear();
  await act(async () => fireEvent.click(notes));
  expect(recording.pause).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Play Chinese homework sentence" })).toBeTruthy();
});
