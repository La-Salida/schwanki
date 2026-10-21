import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mocks = vi.hoisted(() => ({ history: vi.fn(), status: vi.fn(), checkout: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/account", () => ({ useAccount: () => ({ balance: 12, balanceError: false, refreshBalance: mocks.refresh }) }));
vi.mock("@/lib/billing", () => ({ loadBillingHistory: mocks.history }));
vi.mock("@/lib/credits", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/credits")>(), loadCreditsStatus: mocks.status, startCheckout: mocks.checkout }));
import Billing from "./Billing";
const purchase = { id: "p1", credits: 30, createdAt: "2026-10-20", amountCents: 199, currency: "usd", receiptUrl: "https://pay.stripe.com/receipts/one", invoiceUrl: "https://invoice.stripe.com/i/one", invoicePdf: null, documentsUnavailable: false };
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.history.mockResolvedValue({ purchases: [], nextOffset: null, billingConfigured: true });
  mocks.status.mockResolvedValue({ purchasesEnabled: true, available: {}, packs: [{ id: "starter", label: "Starter", credits: 30, priceCents: 199 }] });
});
function mount(path = "/billing") { return render(<MemoryRouter initialEntries={[path]}><Billing /></MemoryRouter>); }
it("shows balance, available packs and an honest empty purchase history", async () => {
  mount();
  expect(await screen.findByText("No credit purchases yet.")).toBeTruthy();
  expect(screen.getByText("Pay as you go · No subscription")).toBeTruthy();
  expect(screen.getByText(/New accounts start with 10 free AI credits/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Buy for $1.99" }).hasAttribute("disabled")).toBe(false);
});
it("shows real purchase documents and paginates without losing earlier purchases", async () => {
  mocks.history.mockResolvedValueOnce({ purchases: [purchase], nextOffset: 10, billingConfigured: true });
  mocks.history.mockResolvedValueOnce({ purchases: [{ ...purchase, id: "p2", credits: 100, receiptUrl: null, invoiceUrl: null, documentsUnavailable: true }], nextOffset: null, billingConfigured: true });
  mount();
  expect((await screen.findByRole("link", { name: /Receipt/ })).getAttribute("href")).toBe(purchase.receiptUrl);
  fireEvent.click(screen.getByRole("button", { name: "Load more purchases" }));
  await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith(10));
  expect(await screen.findByText("Documents temporarily unavailable")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Receipt/ })).toBeTruthy();
});
it("allows history retry and reports checkout failures", async () => {
  mocks.history.mockRejectedValueOnce(new Error("History temporarily unavailable"));
  mocks.checkout.mockRejectedValue(new Error("Checkout unavailable"));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Retry purchase history" }));
  expect(await screen.findByText("No credit purchases yet.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Buy for $1.99" }));
  expect(await screen.findByText("Checkout unavailable")).toBeTruthy();
});
it("doesn't claim a successful payment based on an editable return URL", async () => {
  mount("/billing?credits=success");
  expect(screen.getByText(/once payment is confirmed/)).toBeTruthy();
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
});
it("refreshes payment documents without starting another purchase", async () => {
  mocks.history.mockResolvedValueOnce({ purchases: [{ ...purchase, receiptUrl: null, invoiceUrl: null, documentsUnavailable: true }], nextOffset: null, billingConfigured: true });
  mocks.history.mockResolvedValueOnce({ purchases: [purchase], nextOffset: null, billingConfigured: true });
  mount();
  expect(await screen.findByText("Documents temporarily unavailable")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Refresh purchase history" }));
  expect(await screen.findByRole("link", { name: /Invoice/ })).toBeTruthy();
  expect(mocks.checkout).not.toHaveBeenCalled();
});
it("retries a failed refresh even when existing history has no further page", async () => {
  mocks.history.mockResolvedValueOnce({ purchases: [purchase], nextOffset: null, billingConfigured: true });
  mocks.history.mockRejectedValueOnce(new Error("Refresh unavailable"));
  mocks.history.mockResolvedValueOnce({ purchases: [{ ...purchase, credits: 200 }], nextOffset: null, billingConfigured: true });
  mount();
  await screen.findByRole("link", { name: /Receipt/ });
  fireEvent.click(screen.getByRole("button", { name: "Refresh purchase history" }));
  expect(await screen.findByText(/Refresh unavailable/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry purchase history" }));
  expect(await screen.findByText("200 credits")).toBeTruthy();
  expect(mocks.history).toHaveBeenCalledTimes(3);
  expect(mocks.history).toHaveBeenLastCalledWith();
});
