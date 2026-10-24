import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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
import Review from "./Review";
import { queueReview, flushOutbox, hasQueuedReviews } from "@/offline/outbox";
import { removeCachedDeck } from "@/offline/dueCache";

vi.mock("@/components/ReviewCard", () => ({ ReviewCard: ({ onRate }: { onRate: (rating: "good") => void }) => <button onClick={() => onRate("good")}>Rate good</button> }));
vi.mock("@/components/ReviewFeed", () => ({ ReviewFeed: ({ onRate, onExit, saveError }: { onRate: (rating: "good") => void; onExit: () => void; saveError: string | null }) => <div role="region" aria-label="Review feed"><button onClick={() => onRate("good")}>Rate good</button><button onClick={onExit}>Back to today</button>{saveError && <p role="alert">{saveError}</p>}</div> }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queueReview).mockResolvedValue(undefined);
  vi.mocked(flushOutbox).mockResolvedValue(0);
  vi.mocked(hasQueuedReviews).mockResolvedValue(false);
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
  fireEvent.click(await screen.findByRole("button", { name: "Back to today" }));
  fireEvent.click(await screen.findByRole("button", { name: /delete the your own cards chinese deck/i }));
  expect(screen.getByText(/deletes its 5 cards/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete deck" }));
  await waitFor(() => expect(api.deleteDeck).toHaveBeenCalledWith([null], "zh"));
  await waitFor(() => expect(removeCachedDeck).toHaveBeenCalledWith([null], "zh"));
});

it("offers deck import when the collection is empty", async () => {
  api.listDueCards.mockResolvedValue([]);
  api.reviewGroups.mockResolvedValue([]);
  render(<MemoryRouter><Review /></MemoryRouter>);
  expect(await screen.findByText("Your next word starts here.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Bring your decks" }).getAttribute("href")).toBe("/sources");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your words. Coming back.");
});

it("durably queues a rating before syncing it or advancing the session", async () => {
  let release!: () => void;
  vi.mocked(queueReview).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  render(<MemoryRouter><Review /></MemoryRouter>);
  await screen.findByRole("region", { name: "Review feed" });
  const flushesBeforeRating = vi.mocked(flushOutbox).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Rate good" }));
  expect(queueReview).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ cardId: "c1", reps: 1 }) }), expect.objectContaining({ id: "c1" }));
  expect(vi.mocked(flushOutbox).mock.calls.length).toBe(flushesBeforeRating);
  expect(screen.getByRole("button", { name: "Rate good" })).toBeTruthy();
  release();
  await waitFor(() => expect(screen.queryByRole("button", { name: "Rate good" })).toBeNull());
  expect(vi.mocked(flushOutbox).mock.calls.length).toBeGreaterThan(flushesBeforeRating);
});

it("keeps the current card when local persistence fails", async () => {
  vi.mocked(queueReview).mockRejectedValueOnce(new Error("storage full"));
  render(<MemoryRouter><Review /></MemoryRouter>);
  await screen.findByRole("region", { name: "Review feed" });
  fireEvent.click(screen.getByRole("button", { name: "Rate good" }));
  expect(await screen.findByText("Couldn't save that rating. Try again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Rate good" })).toBeTruthy();
});

it("opens directly in the feed and stays in the overview after exiting", async () => {
  render(<MemoryRouter><Review /></MemoryRouter>);
  expect(await screen.findByRole("region", { name: "Review feed" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start review" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Back to today" }));
  expect(await screen.findByRole("button", { name: "Start review" })).toBeTruthy();
  await waitFor(() => expect(api.listDueCards).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("region", { name: "Review feed" })).toBeNull();
});

it("advances after local persistence while network sync is still pending", async () => {
  render(<MemoryRouter><Review /></MemoryRouter>);
  await screen.findByRole("region", { name: "Review feed" });
  let release!: (count: number) => void;
  vi.mocked(flushOutbox).mockImplementationOnce(() => new Promise<number>(resolve => { release = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Rate good" }));
  expect(await screen.findByRole("heading", { name: "Words reviewed." })).toBeTruthy();
  release(1);
});

it("puts memory aids up front and on every deck", async () => {
  render(<MemoryRouter><Review /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Back to today" }));
  fireEvent.click(await screen.findByRole("button", { name: "Generate memory aids" }));
  expect(screen.getByRole("dialog", { name: "Memory aids" }).textContent).toBe("pick a deck");
});

it("opens memory aids with the deck already picked from the deck's own button", async () => {
  render(<MemoryRouter><Review /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Back to today" }));
  fireEvent.click(await screen.findByRole("button", { name: /generate memory aids for the your own cards chinese deck/i }));
  expect(screen.getByRole("dialog", { name: "Memory aids" }).textContent).toBe("Your own cards|zh");
});
