import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CandidateCardRow } from "@schwanki/core";
const { updateCandidate } = vi.hoisted(() => ({ updateCandidate: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase", () => ({ api: { updateCandidate }, supabase: { functions: { invoke: vi.fn() } } }));
import { CandidateRow } from "./CandidateRow";
afterEach(cleanup);
it("saves a correction and explicitly clears an incorrect pronunciation without approving", async () => {
  const candidate: CandidateCardRow = { id: "c1", sourceId: "s1", front: "明显", back: "wrong", reading: "bad pinyin", rawContext: "", confidence: 0.6, status: "pending", createdAt: "2026-04-14T00:00:00Z" };
  const onApprove = vi.fn(); const onSaved = vi.fn();
  render(<CandidateRow candidate={candidate} onApprove={onApprove} onDiscard={vi.fn()} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /fill missing fields/i }));
  fireEvent.change(screen.getByLabelText("Pinyin / pronunciation"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("English meaning"), { target: { value: "obvious" } });
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
  await waitFor(() => expect(updateCandidate).toHaveBeenCalledWith("c1", expect.objectContaining({ reading: "", back: "obvious" })));
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", reading: "", back: "obvious", status: "pending" }));
  expect(onApprove).not.toHaveBeenCalled();
});
