import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  listDueCards: vi.fn(), reviewGroups: vi.fn(), listSources: vi.fn(), listPendingCandidates: vi.fn(),
  listTeachers: vi.fn(), deleteDeck: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ api, supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/offline/dueCache", () => ({ cacheDueCards: vi.fn().mockResolvedValue(undefined), loadCachedDueCards: vi.fn().mockResolvedValue([]) }));
vi.mock("@/offline/outbox", () => ({ flushOutbox: vi.fn(), queueReview: vi.fn() }));
vi.mock("@/components/BulkProgressBanner", () => ({ BulkProgressBanner: () => null }));
vi.mock("@/components/NotificationPrime", () => ({ NotificationPrime: () => null }));
import Review from "./Review";

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
  render(<MemoryRouter><Review /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /delete the your own cards chinese deck/i }));
  expect(screen.getByText(/deletes its 5 cards/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete deck" }));
  await waitFor(() => expect(api.deleteDeck).toHaveBeenCalledWith([null], "zh"));
});
