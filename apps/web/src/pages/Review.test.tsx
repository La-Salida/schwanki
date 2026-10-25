import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const api = vi.hoisted(() => ({
  listDueCards: vi.fn(), reviewGroups: vi.fn(), listSources: vi.fn(), listPendingCandidates: vi.fn(),
  listTeachers: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ api, supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/offline/dueCache", () => ({ cacheDueCards: vi.fn(async (cards) => cards), loadCachedDueCards: vi.fn().mockResolvedValue([]) }));
vi.mock("@/offline/outbox", () => ({ flushOutbox: vi.fn(), queueReview: vi.fn(), hasQueuedReviews: vi.fn().mockResolvedValue(false) }));
vi.mock("@/components/BulkProgressBanner", () => ({ BulkProgressBanner: () => null }));
vi.mock("@/components/NotificationPrime", () => ({ NotificationPrime: () => null }));
import Review from "./Review";

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; }
function renderReview() {
  return render(<MemoryRouter><Routes><Route path="/" element={<Review />} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
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
});

it("is the home tab: the whole due card starts the review", async () => {
  renderReview();
  expect(await screen.findByText("1 card")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start review: 1 card due" }));
  expect(screen.getByTestId("where").textContent).toBe("/review");
});

it("starts the review with Enter when nothing else has focus", async () => {
  renderReview();
  await screen.findByText("1 card");
  fireEvent.keyDown(window, { key: "Enter" });
  expect(screen.getByTestId("where").textContent).toBe("/review");
});

it("offers deck import when the collection is empty", async () => {
  api.listDueCards.mockResolvedValue([]);
  api.reviewGroups.mockResolvedValue([]);
  renderReview();
  expect(await screen.findByText("Your next word starts here.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Bring your decks" }).getAttribute("href")).toBe("/sources");
});

it("leaves deck management to Decks & notes", async () => {
  renderReview();
  await screen.findByText("1 card");
  expect(screen.queryByRole("button", { name: "Generate memory aids" })).toBeNull();
  expect(screen.queryByRole("button", { name: /delete the/i })).toBeNull();
});

it("lets you review one deck when several have cards due", async () => {
  api.listSources.mockResolvedValue([{ id: "s1", label: "Li Laoshi", type: "pdf_upload", status: "active", language: "zh" }]);
  api.reviewGroups.mockResolvedValue([
    { sourceId: null, language: "zh", total: 5, due: 5, fresh: 5 },
    { sourceId: "s1", language: "zh", total: 3, due: 2, fresh: 0 },
  ]);
  renderReview();
  fireEvent.click(await screen.findByRole("button", { name: /^Li Laoshi/ }));
  expect(screen.getByTestId("where").textContent).toBe("/review?sources=s1&label=Li+Laoshi+%C2%B7+Chinese");
});

it("points to new words waiting to be checked", async () => {
  api.listPendingCandidates.mockResolvedValue([{ id: "x" }, { id: "y" }]);
  renderReview();
  expect((await screen.findByRole("link", { name: /2 new words/ })).getAttribute("href")).toBe("/inbox");
});
