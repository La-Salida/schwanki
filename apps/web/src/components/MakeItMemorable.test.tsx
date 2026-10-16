import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { listApiKeyProviders, creditBalance, loadCreditsStatus, generateMnemonic, loadModelCatalog } = vi.hoisted(() => ({
  listApiKeyProviders: vi.fn(), creditBalance: vi.fn(), loadCreditsStatus: vi.fn(), generateMnemonic: vi.fn(), loadModelCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ api: { listApiKeyProviders, creditBalance } }));
vi.mock("@/lib/credits", () => ({
  loadCreditsStatus,
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
    expect(screen.getByRole("button", { name: "Scene image" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Generate memorable scene" }));
    await waitFor(() => expect(generateMnemonic).toHaveBeenCalledWith("card1", expect.objectContaining({ kinds: ["sentence"] })));
  });
  it("generates the full scene on credits without any saved keys", async () => {
    creditBalance.mockResolvedValue(5);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Generate memorable scene" }));
    await waitFor(() => expect(generateMnemonic).toHaveBeenCalledWith("card1", expect.objectContaining({ kinds: undefined })));
    expect(screen.queryByRole("link", { name: "Buy credits" })).toBeNull();
  });
  it("points to Settings when neither credits nor keys can make anything", async () => {
    creditBalance.mockResolvedValue(0);
    loadCreditsStatus.mockResolvedValue({ ...schwankiAi, available: { sentence: false, image: false, audio: false } });
    show();
    expect(await screen.findByText(/Buy Schwanki AI credits or add your own provider key/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate memorable scene" })).toBeNull();
  });
});
