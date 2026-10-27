import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { invoke, signOutLocal } = vi.hoisted(() => ({ invoke: vi.fn(), signOutLocal: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke }, auth: { signOut: signOutLocal } } }));
vi.mock("@/lib/account", () => ({
  accountName: () => "Ada",
  useAccount: () => ({ user: { email: "ada@example.com", app_metadata: { provider: "google" } }, signOut: vi.fn() }),
}));

import Account from "./Account";

describe("Account deletion", () => {
  beforeEach(() => { invoke.mockReset(); signOutLocal.mockClear(); });
  afterEach(cleanup);

  it("only deletes after the learner types the confirmation word", async () => {
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
    render(<MemoryRouter><Account /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account…" }));
    const submit = screen.getByRole("button", { name: "Delete everything" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Type “delete” to confirm/), { target: { value: "Delete" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(invoke).toHaveBeenCalledWith("delete-account", { body: { confirm: true } });
    expect(signOutLocal).toHaveBeenCalledWith({ scope: "local" });
  });

  it("shows the server's reason when deletion fails", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: "Couldn't remove your files. Nothing was deleted. Try again." }), { status: 500 }) } });
    render(<MemoryRouter><Account /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account…" }));
    fireEvent.change(screen.getByLabelText(/Type “delete” to confirm/), { target: { value: "delete" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Nothing was deleted");
  });
});
