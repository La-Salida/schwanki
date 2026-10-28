import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { listApiKeyProviders, creditBalance, loadCreditsStatus, cachedCreditsStatus, generateMnemonic, loadModelCatalog } = vi.hoisted(() => ({
  listApiKeyProviders: vi.fn(), creditBalance: vi.fn(), loadCreditsStatus: vi.fn(), cachedCreditsStatus: vi.fn(), generateMnemonic: vi.fn(), loadModelCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ api: { listApiKeyProviders, creditBalance } }));
vi.mock("@/lib/credits", () => ({
  loadCreditsStatus,
  cachedCreditsStatus,
  UNKNOWN_STATUS: { purchasesEnabled: false, available: { sentence: false, image: false, audio: false }, packs: [] },
}));
vi.mock("@/lib/catalog", () => ({ loadModelCatalog }));
vi.mock("@/lib/mnemonic", () => ({ generateMnemonic }));
import { MakeItMemorable } from "./MakeItMemorable";

const schwankiAi = { purchasesEnabled: true, available: { sentence: true, image: true, audio: true }, packs: [] };
const show = () => render(<MemoryRouter><MakeItMemorable cardId="card1" /></MemoryRouter>);

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  listApiKeyProviders.mockResolvedValue([]);
  loadModelCatalog.mockResolvedValue(null);
  loadCreditsStatus.mockResolvedValue(schwankiAi);
  generateMnemonic.mockResolvedValue({ cost: 0, failures: [] });
});

describe("Make it memorable with Schwanki AI credits", () => {
  it("offers a free sentence and a way to buy credits when the balance is zero", async () => {
    creditBalance.mockResolvedValue(0);
    show();
    expect(await screen.findByText(/Sentences are free/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByText(/Add your own provider key/)).toBeNull();
    fireEvent.click(screen.getByText("Create just one part"));
    expect(screen.getByRole("button", { name: "Scene image" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Create free sentence" }));
    await waitFor(() => expect(generateMnemonic).toHaveBeenCalledWith("card1", expect.objectContaining({ kinds: ["sentence"] })));
  });
  it("generates the full scene on credits without any saved keys", async () => {
    creditBalance.mockResolvedValue(5);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Create memory aids" }));
    await waitFor(() => expect(generateMnemonic).toHaveBeenCalledWith("card1", expect.objectContaining({ kinds: undefined })));
    expect(screen.queryByRole("link", { name: "Buy credits" })).toBeNull();
  });
  it("opens at once from the remembered status while the credits function wakes up", async () => {
    creditBalance.mockResolvedValue(5);
    cachedCreditsStatus.mockReturnValue(schwankiAi);
    loadCreditsStatus.mockReturnValue(new Promise(() => {}));
    show();
    expect(await screen.findByRole("button", { name: "Create memory aids" })).toBeTruthy();
  });
  it("points to Settings when neither credits nor keys can make anything", async () => {
    creditBalance.mockResolvedValue(0);
    loadCreditsStatus.mockResolvedValue({ ...schwankiAi, available: { sentence: false, image: false, audio: false } });
    show();
    expect(await screen.findByText(/Buy Schwanki AI credits or add your own provider key/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create memory aids" })).toBeNull();
  });
  it("labels replacement clearly and saves the idea on the same card", async () => {
    creditBalance.mockResolvedValue(9);
    const onGenerated = vi.fn();
    render(<MemoryRouter><MakeItMemorable cardId="original-card" embedded hasMedia onGenerated={onGenerated} /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Your association for this word"), { target: { value: "a goose in grandma’s kitchen" } });
    fireEvent.click(await screen.findByRole("button", { name: "Replace memory aids" }));
    await waitFor(() => expect(generateMnemonic).toHaveBeenCalledWith("original-card", expect.objectContaining({ hook: "a goose in grandma’s kitchen" })));
    expect(onGenerated).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toContain("Saved on this word");
  });
});
