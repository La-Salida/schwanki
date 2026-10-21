import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ balance: vi.fn(), signOut: vi.fn(), prepare: vi.fn(), clearCache: vi.fn() }));
vi.mock("./supabase", () => ({ api: { creditBalance: mocks.balance }, supabase: { auth: { signOut: mocks.signOut } } }));
vi.mock("@/offline/signOut", () => ({ prepareSignOut: mocks.prepare, clearDueCache: mocks.clearCache }));
import { useAccount } from "./account";
import { AccountProvider } from "@/components/AccountProvider";
import { notifyCreditsChanged } from "./creditEvents";
const user = { id: "u1", email: "jamie@example.com", user_metadata: {}, app_metadata: {} } as User;
function Probe() {
  const state = useAccount();
  return <><p>{state.balanceError ? "Unavailable" : state.balance === null ? "Loading" : `${state.balance} credits`}</p><button onClick={() => void state.signOut().catch(() => {})}>Log out</button></>;
}
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.balance.mockResolvedValue(12); mocks.signOut.mockResolvedValue({ error: null }); mocks.prepare.mockResolvedValue(undefined); mocks.clearCache.mockResolvedValue(undefined); });
it("refreshes the shared count after credits change", async () => {
  render(<AccountProvider user={user}><Probe /></AccountProvider>);
  expect(await screen.findByText("12 credits")).toBeTruthy();
  mocks.balance.mockResolvedValue(11); notifyCreditsChanged();
  expect(await screen.findByText("11 credits")).toBeTruthy();
});
it("reports a failed refresh rather than inventing a zero balance", async () => {
  mocks.balance.mockRejectedValue(new Error("offline"));
  render(<AccountProvider user={user}><Probe /></AccountProvider>);
  expect(await screen.findByText("Unavailable")).toBeTruthy();
});
it("prepares offline work before logging out of this browser", async () => {
  render(<AccountProvider user={user}><Probe /></AccountProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
  expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]!);
});
it("doesn't abandon a session if offline work cannot be saved", async () => {
  mocks.prepare.mockRejectedValue(new Error("pending reviews"));
  render(<AccountProvider user={user}><Probe /></AccountProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(mocks.prepare).toHaveBeenCalled());
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it("doesn't let an older balance request overwrite a newer refresh", async () => {
  let resolveOlder!: (value: number) => void;
  mocks.balance.mockReturnValueOnce(new Promise<number>(resolve => { resolveOlder = resolve; }));
  mocks.balance.mockResolvedValueOnce(11);
  render(<AccountProvider user={user}><Probe /></AccountProvider>);
  notifyCreditsChanged();
  expect(await screen.findByText("11 credits")).toBeTruthy();
  await act(async () => { resolveOlder(12); });
  expect(screen.getByText("11 credits")).toBeTruthy();
});

it("keeps the due cache when authentication logout fails", async () => {
  mocks.signOut.mockResolvedValue({ error: new Error("network unavailable") });
  render(<AccountProvider user={user}><Probe /></AccountProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
  expect(mocks.clearCache).not.toHaveBeenCalled();
});
it("clears cached cards only after authentication logout succeeds", async () => {
  render(<AccountProvider user={user}><Probe /></AccountProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(mocks.clearCache).toHaveBeenCalled());
  expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(mocks.clearCache.mock.invocationCallOrder[0]!);
});
