import { beforeEach, expect, it, vi } from "vitest";

const { insert, getSession } = vi.hoisted(() => ({ insert: vi.fn(), getSession: vi.fn() }));
vi.mock("./supabase", () => ({
  supabase: { auth: { getSession }, from: vi.fn(() => ({ insert })) },
}));
import { enqueueBulk } from "./bulk";

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
});

it("sends the caller's user id so the bulk_jobs insert policy accepts the rows", async () => {
  expect(await enqueueBulk([{ cardId: "c1", kinds: ["sentence", "image"] }])).toBe(1);
  expect(insert).toHaveBeenCalledWith([{ user_id: "u1", card_id: "c1", kinds: ["sentence", "image"] }]);
});

it("queues nothing when signed out", async () => {
  getSession.mockResolvedValue({ data: { session: null } });
  expect(await enqueueBulk([{ cardId: "c1", kinds: ["audio"] }])).toBe(0);
  expect(insert).not.toHaveBeenCalled();
});
