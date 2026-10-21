import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const account = vi.hoisted(() => ({ user: { email: "learner@example.com", user_metadata: { full_name: "Jamie Learner" }, app_metadata: { provider: "google" } }, balance: 12 as number | null, balanceError: false, signOut: vi.fn() }));
vi.mock("@/lib/account", () => ({ useAccount: () => account, accountName: () => "Jamie Learner" }));
import { AppNav } from "./AppNav";
afterEach(cleanup);
beforeEach(() => { account.balance = 12; account.balanceError = false; });
it("identifies the current page, keeps goose branding, and exposes credit/account controls", () => {
  render(<MemoryRouter initialEntries={["/sources"]}><AppNav /></MemoryRouter>);
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Decks & notes" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content");
  const brand = screen.getByRole("link", { name: "Schwanki" });
  expect(brand.querySelector("img")?.getAttribute("src")).toBe("/goose.png");
  expect(brand.textContent).toBe("Schwanki");
  expect(screen.getByRole("link", { name: "12 credits available. View billing" }).getAttribute("href")).toBe("/billing");
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/billing#credit-packs");
});
it("doesn't display an unavailable or loading balance as zero", () => {
  account.balance = null;
  const { rerender } = render(<MemoryRouter><AppNav /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /loading credit balance/ })).toBeTruthy();
  account.balanceError = true;
  rerender(<MemoryRouter><AppNav /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /credit balance unavailable/ })).toBeTruthy();
  expect(screen.queryByText("0 credits")).toBeNull();
});
