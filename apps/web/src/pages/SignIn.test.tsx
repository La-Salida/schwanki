import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
