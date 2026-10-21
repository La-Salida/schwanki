import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/lib/account", () => ({ useAccount: () => ({ user: { email: "jamie@example.com" }, signOut }), accountName: () => "Jamie Learner" }));
import { AccountMenu } from "./AccountMenu";
afterEach(cleanup);
beforeEach(() => { signOut.mockReset(); });
function open() {
  const result = render(<MemoryRouter><AccountMenu /></MemoryRouter>);
  fireEvent.click(screen.getByText("Account"));
  return result;
}
it("shows signed-in identity and direct account/billing links", () => {
  open();
  expect(screen.getByText("jamie@example.com")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Billing & invoices/ }).getAttribute("href")).toBe("/billing");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.querySelector("details")?.open).toBe(false);
  expect(document.activeElement?.tagName).toBe("SUMMARY");
});
it("closes when clicking outside", () => {
  open(); fireEvent.pointerDown(document.body);
  expect(document.querySelector("details")?.open).toBe(false);
});
it("keeps logout errors visible and lets the user retry", async () => {
  signOut.mockRejectedValueOnce(new Error("Offline reviews haven't synced"));
  signOut.mockResolvedValueOnce(undefined);
  open(); fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Offline reviews haven't synced");
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
});
