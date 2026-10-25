import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const api = vi.hoisted(() => ({ listDueCards: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ api, supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/offline/dueCache", () => ({ cacheDueCards: vi.fn(async (cards) => cards), loadCachedDueCards: vi.fn().mockResolvedValue([]) }));
vi.mock("@/offline/outbox", () => ({ flushOutbox: vi.fn(), queueReview: vi.fn(), hasQueuedReviews: vi.fn().mockResolvedValue(false) }));
vi.mock("@/components/ReviewFeed", () => ({ ReviewFeed: ({ queue, label, onRate, onExit, saveError }: { queue: Array<{ card: { front: string } }>; label: string; onRate: (rating: "good") => void; onExit: () => void; saveError: string | null }) =>
  <div role="region" aria-label="Review feed"><p>{label}: {queue.map((d) => d.card.front).join(",")}</p><button onClick={() => onRate("good")}>Rate good</button><button onClick={onExit}>Back to today</button>{saveError && <p role="alert">{saveError}</p>}</div> }));
import ReviewSession from "./ReviewSession";
import { queueReview, flushOutbox, hasQueuedReviews } from "@/offline/outbox";

function renderSession(url = "/review") {
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/review" element={<ReviewSession />} />
    <Route path="/" element={<p>Today page</p>} />
  </Routes></MemoryRouter>);
}

const card = (id: string, sourceId: string | null) => ({ card: { id, userId: "u", sourceId, language: "zh", front: id, back: "hello", createdAt: "2026-10-01" }, state: null });

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queueReview).mockResolvedValue(undefined);
  vi.mocked(flushOutbox).mockResolvedValue(0);
  vi.mocked(hasQueuedReviews).mockResolvedValue(false);
  api.listDueCards.mockResolvedValue([card("c1", null)]);
});

it("opens straight into the feed and goes back to Today on exit", async () => {
  renderSession();
  expect(await screen.findByText("Today's review: c1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to today" }));
  expect(screen.getByText("Today page")).toBeTruthy();
});

it("limits a deck session to that deck's cards", async () => {
  api.listDueCards.mockResolvedValue([card("mine", null), card("class", "s1"), card("other", "s2")]);
  renderSession("/review?sources=own,s1&label=Deck");
  const text = (await screen.findByText(/^Deck:/)).textContent!;
  expect(text.replace("Deck: ", "").split(",").sort()).toEqual(["class", "mine"]);
});

it("says so when nothing is due", async () => {
  api.listDueCards.mockResolvedValue([]);
  renderSession();
  expect(await screen.findByRole("heading", { name: "Nothing due right now." })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to today" }).getAttribute("href")).toBe("/");
});

it("durably queues a rating before syncing it or advancing the session", async () => {
  let release!: () => void;
  vi.mocked(queueReview).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  renderSession();
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
  renderSession();
  await screen.findByRole("region", { name: "Review feed" });
  fireEvent.click(screen.getByRole("button", { name: "Rate good" }));
  expect(await screen.findByText("Couldn't save that rating. Try again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Rate good" })).toBeTruthy();
});

it("advances after local persistence while network sync is still pending", async () => {
  renderSession();
  await screen.findByRole("region", { name: "Review feed" });
  let release!: (count: number) => void;
  vi.mocked(flushOutbox).mockImplementationOnce(() => new Promise<number>(resolve => { release = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Rate good" }));
  expect(await screen.findByRole("heading", { name: "Words reviewed." })).toBeTruthy();
  release(1);
});
