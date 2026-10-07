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
