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
const listSyncProgress = vi.fn();
vi.mock("@/lib/supabase", () => ({
  api: {
    listSources: () => listSources(),
    listSyncProgress: () => listSyncProgress(),
    updateSource: (...a: unknown[]) => updateSource(...a),
    removeSource: (...a: unknown[]) => removeSource(...a),
    uploadSourcePdf: (...a: unknown[]) => uploadSourcePdf(...a),
    addSource: vi.fn(),
    listTeachers: () => Promise.resolve([]),
    listPendingCandidates: () => listPendingCandidates(),
    linkTeacherPreply: (...a: unknown[]) => linkTeacherPreply(...a),
  },
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

const listPendingCandidates = vi.fn(() => Promise.resolve([] as unknown[]));
const connectGoogleDrive = vi.fn();
vi.mock("@/components/DeckManager", () => ({ DeckManager: () => null }));
vi.mock("@/lib/auth", () => ({ connectGoogleDrive: () => connectGoogleDrive() }));

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
  for (const fn of [listSources, updateSource, removeSource, uploadSourcePdf, invoke, linkTeacherPreply, listSyncProgress]) fn.mockReset();
  listSyncProgress.mockResolvedValue({});
  listSources.mockResolvedValue([sheet, canvaPdf]);
  invoke.mockResolvedValue({ data: { results: { s1: "unchanged", s2: "diffed:1" } }, error: null });
});

describe("Sources page", () => {
  it("shows a scheduled sync and a running parse on their rows, with Sync disabled", async () => {
    listSyncProgress.mockResolvedValue({
      s1: { sourceId: "s1", syncing: true, parseStatus: null },
      s2: { sourceId: "s2", syncing: false, parseStatus: "running" },
    });
    renderPage();
    expect(await screen.findByText(/fetching the latest notes/i)).toBeTruthy();
    expect(screen.getByText(/reading new words/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /syncing/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /reading/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
  });

  it("reports how many new words the latest sync found", async () => {
    listSources.mockResolvedValue([{ ...canvaPdf, lastSyncedAt: "2026-10-14T07:00:00Z" }]);
    listSyncProgress.mockResolvedValue({
      s2: { sourceId: "s2", syncing: false, parseStatus: "done", wordsFound: 7, parseFinishedAt: "2026-10-14T07:01:00Z" },
    });
    renderPage();
    expect(await screen.findByText(/7 new words sent to the inbox/i)).toBeTruthy();
  });

  it("says a source is up to date instead of opening an empty Inbox", async () => {
    listSources.mockResolvedValue([sheet]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /sync now/i }));
    expect(await screen.findByText(/Dogfood is up to date/i)).toBeTruthy();
  });

  it("offers Add class notes for a teacher who only has a Google Doc", async () => {
    listSources.mockResolvedValue([sheet]);
    renderPage();
    expect(await screen.findByRole("button", { name: /\+ add class notes/i })).toBeTruthy();
  });

  it("still lists sources when sync progress can't load", async () => {
    listSyncProgress.mockRejectedValue(new Error("function source_sync_progress does not exist"));
    renderPage();
    expect(await screen.findByText("Dogfood")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /sync now/i })).toHaveLength(2);
  });

  it("revoked google rows offer Connect Google Drive instead of a sync that can't work", async () => {
    listSources.mockResolvedValue([{ ...sheet, status: "revoked" }]);
    connectGoogleDrive.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /connect google drive/i }));
    expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
    expect(connectGoogleDrive).toHaveBeenCalledTimes(1);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("google rows offer Sync now; pdf rows additionally offer Update PDF", async () => {
    renderPage();
    expect(await screen.findByText("Dogfood")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /sync now/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /update file/i })).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: /update file/i }));
    const file = new File(["%PDF-1.4"], "v2.pdf", { type: "application/pdf" });
    fireEvent.change(await screen.findByLabelText(/update class file/i), { target: { files: [file] } });
    await waitFor(() => expect(uploadSourcePdf).toHaveBeenCalledWith("s2", file));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("sync-pdf", { body: { sourceId: "s2" } }));
  });

  it("rejects unreadable PowerPoints before replacing an existing class file", async () => {
    listSources.mockResolvedValue([canvaPdf]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /update file/i }));
    const file = new File(["broken"], "v2.pptx");
    fireEvent.change(await screen.findByLabelText(/update class file/i), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/could not read/i));
    expect(uploadSourcePdf).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("Add class PDF reuses the teacher and language without updating the previous class file", async () => {
    listSources.mockResolvedValue([{ ...canvaPdf, label: "Teacher Chen · 2026-04-14", language: "zh" }]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add class notes/i }));
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

  it("Sync all syncs every connected source and reports when nothing is new", async () => {
    const recording: Source = { ...sheet, id: "s3", type: "class_recording", label: "Dogfood" };
    listSources.mockResolvedValue([sheet, canvaPdf, recording]);
    invoke.mockImplementation((_fn: string, { body }: { body: { sourceId: string } }) =>
      Promise.resolve({ data: { results: { [body.sourceId]: "unchanged" } }, error: null }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /sync all/i }));
    expect(await screen.findByText(/Everything is up to date/)).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("sync-google", { body: { sourceId: "s1" } });
    expect(invoke).toHaveBeenCalledWith("sync-pdf", { body: { sourceId: "s2" } });
    expect(invoke).toHaveBeenCalledTimes(2); // recordings have no sync function
  });

  it("adds a new teacher from a Preply link and opens their class notes form", async () => {
    linkTeacherPreply.mockResolvedValue({ name: "Tian W.", photoUrl: "https://avatars.preply.com/t.jpg", language: "zh" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add new teacher" }));
    fireEvent.change(screen.getByLabelText(/preply profile link/i), { target: { value: "https://preply.com/ko/tutor/7238852" } });
    fireEvent.click(screen.getByRole("button", { name: "Find teacher" }));
    await waitFor(() => expect(linkTeacherPreply).toHaveBeenCalledWith(null, "https://preply.com/ko/tutor/7238852"));
    expect(await screen.findByRole("heading", { name: "Add Tian W.'s class notes" })).toBeTruthy();
    expect((screen.getByLabelText(/teacher name/i) as HTMLInputElement).value).toBe("Tian W.");
  });

  it("shows how each teacher's notes sync", async () => {
    renderPage();
    const chips = await screen.findByRole("list", { name: /how marina's notes sync/i });
    expect(chips.textContent).toContain("Canva");
    expect(screen.getByRole("list", { name: /how dogfood's notes sync/i }).textContent).toContain("Google Sheet");
  });

  it("offers an Anki import or a teacher's notes when there is nothing yet", async () => {
    listSources.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("button", { name: "Import an Anki deck" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add a teacher's class notes" }));
    expect(screen.getByRole("heading", { name: "Add new teacher" })).toBeTruthy();
    expect(screen.getByLabelText(/preply profile link/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add class notes" }));
    expect(screen.getByRole("button", { name: /connect source/i })).toBeTruthy();
  });

  it("lists imported Anki decks apart from teachers", async () => {
    listSources.mockResolvedValue([sheet, { ...sheet, id: "a1", type: "anki_deck", externalRef: "anki:core.apkg#Core 2k", label: "Core 2k", language: "ja" }]);
    renderPage();
    const decks = await screen.findByRole("region", { name: "Anki decks" });
    expect(decks.textContent).toContain("Core 2k");
    expect(decks.textContent).toContain("Japanese");
    expect(screen.queryByRole("region", { name: "Core 2k" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Import Anki deck" }));
    expect(screen.getByLabelText("Have your export? Choose your Anki file")).toBeTruthy();
  });
});
