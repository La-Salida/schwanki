import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Source } from "@schwanki/core";

afterEach(cleanup);

const listSources = vi.fn();
const updateSource = vi.fn();
const removeSource = vi.fn();
const uploadSourcePdf = vi.fn();
const invoke = vi.fn();
vi.mock("@/lib/supabase", () => ({
  api: {
    listSources: () => listSources(),
    updateSource: (...a: unknown[]) => updateSource(...a),
    removeSource: (...a: unknown[]) => removeSource(...a),
    uploadSourcePdf: (...a: unknown[]) => uploadSourcePdf(...a),
    addSource: vi.fn(),
  },
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import Sources from "./Sources";

const sheet: Source = {
  id: "s1", userId: "u1", type: "google_sheet",
  externalRef: "https://docs.google.com/spreadsheets/d/1NvH",
  label: "Dogfood", language: "zh", status: "active",
};
const canvaPdf: Source = {
  id: "s2", userId: "u1", type: "pdf_upload",
  externalRef: "https://www.canva.com/design/DAF123abc/view",
  label: "Marina", language: "ja", status: "active",
};

function renderPage() {
  return render(<MemoryRouter><Sources /></MemoryRouter>);
}

beforeEach(() => {
  for (const fn of [listSources, updateSource, removeSource, uploadSourcePdf, invoke]) fn.mockReset();
  listSources.mockResolvedValue([sheet, canvaPdf]);
  invoke.mockResolvedValue({ data: { results: {} }, error: null });
});

describe("Sources page", () => {
  it("google rows offer Sync now; pdf rows additionally offer Update PDF", async () => {
    renderPage();
    expect(await screen.findByText("Dogfood")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /sync now/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /update pdf/i })).toBeTruthy();
  });

  it("canva-backed rows link to the design", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /canva\.com\/design/i });
    expect(link.getAttribute("href")).toBe(canvaPdf.externalRef);
  });

  it("Sync now on a pdf source invokes sync-pdf", async () => {
    listSources.mockResolvedValue([canvaPdf]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /sync now/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("sync-pdf", { body: { sourceId: "s2" } }));
  });

  it("edit saves label and language", async () => {
    renderPage();
    const editButtons = await screen.findAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]!);
    fireEvent.change(screen.getByDisplayValue("Dogfood"), { target: { value: "Dogfood v2" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateSource).toHaveBeenCalledWith("s1", { label: "Dogfood v2", language: "zh" }));
  });

  it("remove dialog defaults to keep and calls removeSource with the chosen mode", async () => {
    renderPage();
    const removeButtons = await screen.findAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[0]!);
    fireEvent.click(screen.getByRole("radio", { name: /remove its inbox candidates too/i }));
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(removeSource).toHaveBeenCalledWith("s1", "drop_pending"));
  });

  it("Update PDF uploads the file then syncs", async () => {
    listSources.mockResolvedValue([canvaPdf]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /update pdf/i }));
    const file = new File(["%PDF-1.4"], "v2.pdf", { type: "application/pdf" });
    fireEvent.change(await screen.findByLabelText(/update pdf file/i), { target: { files: [file] } });
    await waitFor(() => expect(uploadSourcePdf).toHaveBeenCalledWith("s2", file));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("sync-pdf", { body: { sourceId: "s2" } }));
  });
});
