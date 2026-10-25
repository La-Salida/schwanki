import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const api = vi.hoisted(() => ({
  listDueCards: vi.fn(), reviewGroups: vi.fn(), listSources: vi.fn(), listPendingCandidates: vi.fn(),
  listTeachers: vi.fn(), deleteDeck: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ api, supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/offline/dueCache", () => ({ cacheDueCards: vi.fn(async (cards) => cards), loadCachedDueCards: vi.fn().mockResolvedValue([]), removeCachedDeck: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/offline/outbox", () => ({ flushOutbox: vi.fn(), queueReview: vi.fn(), hasQueuedReviews: vi.fn().mockResolvedValue(false) }));
vi.mock("@/components/BulkProgressBanner", () => ({ BulkProgressBanner: () => null }));
vi.mock("@/components/NotificationPrime", () => ({ NotificationPrime: () => null }));
vi.mock("@/components/BulkGenerateModal", () => ({
  BulkGenerateModal: ({ initialDeck }: { initialDeck?: { teacher: string; language: string } }) =>
    <div role="dialog" aria-label="Memory aids">{initialDeck ? `${initialDeck.teacher}|${initialDeck.language}` : "pick a deck"}</div>,
}));
import { DeckManager } from "@/components/DeckManager";
import { removeCachedDeck } from "@/offline/dueCache";

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; }
function renderDecks() {
  return render(<MemoryRouter initialEntries={["/sources"]}><Routes><Route path="/sources" element={<DeckManager sources={[]} teachers={[]} />} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  const card = { id: "c1", userId: "u", sourceId: null, language: "zh", front: "你好", back: "hello", createdAt: "2026-10-01" };
  api.listDueCards.mockResolvedValue([{ card, state: null }]);
  api.reviewGroups.mockResolvedValue([{ sourceId: null, language: "zh", total: 5, due: 5, fresh: 5 }]);
  api.listSources.mockResolvedValue([]);
  api.listPendingCandidates.mockResolvedValue([]);
  api.listTeachers.mockResolvedValue([]);
  api.deleteDeck.mockResolvedValue(5);
});

it("deletes a deck after confirming", async () => {
  renderDecks();
  fireEvent.click(await screen.findByRole("button", { name: /delete the your own cards chinese deck/i }));
  expect(screen.getByText(/deletes its 5 cards/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete deck" }));
  await waitFor(() => expect(api.deleteDeck).toHaveBeenCalledWith([null], "zh"));
  await waitFor(() => expect(removeCachedDeck).toHaveBeenCalledWith([null], "zh"));
});

it("offers memory aids for any deck", async () => {
  renderDecks();
  fireEvent.click(await screen.findByRole("button", { name: "Generate memory aids" }));
  expect(screen.getByRole("dialog", { name: "Memory aids" }).textContent).toBe("pick a deck");
});

it("opens memory aids with the deck already picked from the deck's own button", async () => {
  renderDecks();
  fireEvent.click(await screen.findByRole("button", { name: /generate memory aids for the your own cards chinese deck/i }));
  expect(screen.getByRole("dialog", { name: "Memory aids" }).textContent).toBe("Your own cards|zh");
});

it("starts that deck's review from its card", async () => {
  renderDecks();
  fireEvent.click(await screen.findByRole("button", { name: /^Your own cards/ }));
  expect(screen.getByTestId("where").textContent).toBe("/review?sources=own&label=Your+own+cards+%C2%B7+Chinese");
});
