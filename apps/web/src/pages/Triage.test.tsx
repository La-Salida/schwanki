import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { listPendingCandidates, listSources, approveCandidate } = vi.hoisted(() => ({
  listPendingCandidates: vi.fn(), listSources: vi.fn(), approveCandidate: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ api: { listPendingCandidates, listSources, approveCandidate } }));
vi.mock("@/components/CandidateRow", () => ({ CandidateRow: ({ candidate }: { candidate: { front: string } }) => <p>{candidate.front}</p> }));
import Triage from "./Triage";

const source = { id: "class1", label: "Teacher Chen · 2026-04-14", language: "zh", type: "pdf_upload" };
const candidate = { id: "c1", sourceId: source.id, front: "明显", back: "obvious", confidence: 0.8, createdAt: "2026-10-07T12:00:00Z" };
afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => {
  vi.resetAllMocks();
  listSources.mockResolvedValue([source]);
  listPendingCandidates.mockResolvedValue([candidate]);
});

describe("class PDF inbox", () => {
  it("identifies the original class rather than the date it was uploaded", async () => {
    render(<MemoryRouter><Triage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Teacher Chen · 2026-04-14 · 1 word" })).toBeTruthy();
    expect(screen.getByText("明显")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /2026-10-07/ })).toBeNull();
  });
  it("shows one import status and automatically reveals vocabulary when it arrives", async () => {
    vi.useFakeTimers();
    listPendingCandidates.mockResolvedValueOnce([]).mockResolvedValue([candidate]);
    await act(async () => {
      render(<MemoryRouter initialEntries={[{ pathname: "/inbox", state: { importingSourceId: source.id, importingLabel: source.label } }]}><Triage /></MemoryRouter>);
    });
    expect(screen.getByRole("heading", { name: "Your notes are in." })).toBeTruthy();
    expect(screen.getByText(source.label)).toBeTruthy();
    expect(screen.getByText(/Words will appear here automatically/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /refresh inbox/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /add or sync class notes/i })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText("明显")).toBeTruthy();
    expect(screen.queryByText("Preparing vocabulary")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(listPendingCandidates).toHaveBeenCalledTimes(2);
  });
  it("stops polling after leaving the inbox", async () => {
    vi.useFakeTimers();
    listPendingCandidates.mockResolvedValue([]);
    let unmount: () => void = () => {};
    await act(async () => {
      ({ unmount } = render(<MemoryRouter initialEntries={[{ pathname: "/inbox", state: { importingSourceId: source.id } }]}><Triage /></MemoryRouter>));
    });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(listPendingCandidates).toHaveBeenCalledTimes(1);
  });
  it("shows a source failure instead of an endless preparing state", async () => {
    listPendingCandidates.mockResolvedValue([]);
    listSources.mockResolvedValue([{ ...source, status: "error", errorDetail: "This PDF has no selectable text." }]);
    render(<MemoryRouter initialEntries={[{ pathname: "/inbox", state: { importingSourceId: source.id } }]}><Triage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "These notes need another look." })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("This PDF has no selectable text.");
    expect(screen.getByRole("link", { name: "Check class notes" })).toBeTruthy();
    expect(screen.queryByText("Preparing vocabulary")).toBeNull();
  });
  it("explains when onboarding PDFs yielded no vocabulary", async () => {
    listPendingCandidates.mockResolvedValue([]);
    render(<MemoryRouter initialEntries={[{ pathname: "/inbox", state: { onboardingDone: true } }]}><Triage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "No new words in those notes" })).toBeTruthy();
    expect(screen.getByText(/couldn't pull vocabulary out of it/)).toBeTruthy();
    expect(screen.queryByText("Your Inbox is clear")).toBeNull();
    expect(screen.getByRole("link", { name: /add or sync class notes/i })).toBeTruthy();
  });
  it("approves the class cards for review", async () => {
    render(<MemoryRouter><Triage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /approve all/i }));
    await waitFor(() => expect(approveCandidate).toHaveBeenCalledWith(candidate));
  });
});
