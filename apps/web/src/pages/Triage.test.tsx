import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { listPendingCandidates, listSources, approveCandidate } = vi.hoisted(() => ({
  listPendingCandidates: vi.fn(), listSources: vi.fn(), approveCandidate: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ api: { listPendingCandidates, listSources, approveCandidate } }));
vi.mock("@/components/CandidateRow", () => ({ CandidateRow: ({ candidate }: { candidate: { front: string } }) => <p>{candidate.front}</p> }));
import Triage from "./Triage";

const source = { id: "class1", label: "Teacher Chen · 2026-04-14", language: "zh", type: "pdf_upload" };
const candidate = { id: "c1", sourceId: source.id, front: "明显", back: "obvious", confidence: 0.8, createdAt: "2026-10-07T12:00:00Z" };
afterEach(cleanup);
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
  it("shows queued extraction and lets the learner refresh until vocabulary arrives", async () => {
    listPendingCandidates.mockResolvedValueOnce([]).mockResolvedValue([candidate]);
    render(<MemoryRouter initialEntries={[{ pathname: "/inbox", state: { importingSourceId: source.id, importingLabel: source.label } }]}><Triage /></MemoryRouter>);
    expect(await screen.findByText(/Vocabulary is being prepared/)).toBeTruthy();
    expect(screen.queryByText(/Inbox zero/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /refresh inbox/i }));
    expect(await screen.findByText("明显")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Vocabulary is being prepared/)).toBeNull());
  });
  it("approves the class cards for review", async () => {
    render(<MemoryRouter><Triage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /approve all/i }));
    await waitFor(() => expect(approveCandidate).toHaveBeenCalledWith(candidate));
  });
});
