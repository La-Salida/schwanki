import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@/lib/auth", () => ({ signInWithGoogle: vi.fn() }));
import Pricing from "./Pricing";
afterEach(cleanup);

it("prices every pack per card and never overstates the savings", () => {
  render(<Pricing signedIn={false} />);
  expect(screen.getByText("5¢ a card")).toBeTruthy();
  expect(screen.getByText("Save 20%")).toBeTruthy();
  expect(screen.getByText("Save 33%")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Sign in to buy" })).toHaveLength(3);
});

it("sends signed-in visitors to Billing to buy", () => {
  render(<Pricing signedIn />);
  expect(screen.getByRole("link", { name: "Buy Plus · $20" }).getAttribute("href")).toBe("/billing#credit-packs");
});
