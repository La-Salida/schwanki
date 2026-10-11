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
const linkTeacherPreply = vi.fn();
vi.mock("@/lib/supabase", () => ({
  api: {
    listSources: () => listSources(),
    updateSource: (...a: unknown[]) => updateSource(...a),
    removeSource: (...a: unknown[]) => removeSource(...a),
    uploadSourcePdf: (...a: unknown[]) => uploadSourcePdf(...a),
    addSource: vi.fn(),
    listTeachers: () => Promise.resolve([]),
    linkTeacherPreply: (...a: unknown[]) => linkTeacherPreply(...a),
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
  for (const fn of [listSources, updateSource, removeSource, uploadSourcePdf, invoke, linkTeacherPreply]) fn.mockReset();
  listSources.mockResolvedValue([sheet, canvaPdf]);
  invoke.mockResolvedValue({ data: { results: { s1: "unchanged", s2: "diffed:1" } }, error: null });
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

  it("Add class PDF reuses the teacher and language without updating the previous class file", async () => {
    listSources.mockResolvedValue([{ ...canvaPdf, label: "Teacher Chen · 2026-04-14", language: "zh" }]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add class pdf/i }));
    expect((screen.getByLabelText(/teacher name/i) as HTMLInputElement).value).toBe("Teacher Chen");
    expect(screen.queryByLabelText(/class date/i)).toBeNull(); // per-file dates appear once files are picked
    expect(uploadSourcePdf).not.toHaveBeenCalled();
  });

  it("does not report a successful sync when the server returns no result for the source", async () => {
    invoke.mockResolvedValue({ data: { results: {} }, error: null });
    listSources.mockResolvedValue([canvaPdf]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /sync now/i }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("no result"));
  });

  it("groups classes under their teacher and links the teacher's Preply photo", async () => {
    listSources.mockResolvedValue([
      { ...canvaPdf, id: "a", label: "Teacher Chen · 2026-04-14", language: "zh" },
      { ...canvaPdf, id: "b", label: "Teacher Chen · 2026-04-21", language: "zh" },
    ]);
    linkTeacherPreply.mockResolvedValue({ photoUrl: "https://avatars.preply.com/a.jpg" });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Teacher Chen" })).toBeTruthy();
    expect(screen.getByText("2 sources")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add preply photo/i }));
    fireEvent.change(screen.getByLabelText(/preply profile link/i), { target: { value: "https://preply.com/en/tutor/42" } });
    fireEvent.click(screen.getByRole("button", { name: /use this photo/i }));
    await waitFor(() => expect(linkTeacherPreply).toHaveBeenCalledWith("Teacher Chen", "https://preply.com/en/tutor/42"));
  });
});
