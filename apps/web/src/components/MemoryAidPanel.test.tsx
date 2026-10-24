import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("./MakeItMemorable", () => ({ MakeItMemorable: () => <textarea aria-label="Scene idea" /> }));
import { MemoryAidPanel } from "./MemoryAidPanel";

afterEach(cleanup);
const card = { id: "c1", userId: "u1", sourceId: null, language: "zh", front: "明显", reading: "míngxiǎn", back: "obvious", createdAt: "2026-10-23" };

function Fixture() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Add a memory aid</button>{open && <MemoryAidPanel card={card} hasMedia={false} onClose={() => setOpen(false)} onGenerated={vi.fn()} />}</>;
}

it("keeps the word, reading and meaning in the editor header and returns focus on Escape", () => {
  render(<Fixture />);
  const opener = screen.getByRole("button", { name: "Add a memory aid" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Make it memorable" });
  const header = dialog.querySelector("header")!;
  expect(within(header).getByText("明显")).toBeTruthy();
  expect(within(header).getByText("míngxiǎn")).toBeTruthy();
  expect(within(header).getByText("obvious")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back to review" }));
  fireEvent.keyDown(screen.getByLabelText("Scene idea"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
