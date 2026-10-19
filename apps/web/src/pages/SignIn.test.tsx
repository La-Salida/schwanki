import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const { signInWithGoogle } = vi.hoisted(() => ({ signInWithGoogle: vi.fn() }));
vi.mock("@/lib/auth", () => ({ signInWithGoogle }));
import SignIn from "./SignIn";
afterEach(cleanup);
it("keeps sign-in available after an OAuth failure and explains how to retry", async () => {
  signInWithGoogle.mockRejectedValueOnce(new Error("Connection failed"));
  render(<SignIn />);
  fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Connection failed");
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toHaveProperty("disabled", false);
});
it("shows the demo sentence with the target word highlighted", () => {
  render(<SignIn />);
  const marks = Array.from(document.querySelectorAll(".landing-demo mark")).map((m) => m.textContent);
  expect(marks).toEqual(["偷", "tōu", "stole"]);
  expect(document.querySelector(".landing-demo video")?.getAttribute("src")).toBe("/demo/goose-steals-homework.mp4");
});
it("lets visitors pause the looping demo clip", () => {
  render(<SignIn />);
  expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
});
it("pitches Schwanki as a modern take on Anki", () => {
  render(<SignIn />);
  expect(screen.getByText("A modern take on Anki")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Doomscrollyour vocab.");
});
