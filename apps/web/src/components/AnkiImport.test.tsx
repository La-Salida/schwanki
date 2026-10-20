import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { openAnkiFile, importDeck } = vi.hoisted(() => ({ openAnkiFile: vi.fn(), importDeck: vi.fn() }));
vi.mock("@/lib/anki/import", () => ({ openAnkiFile, importDeck }));
import { AnkiImport } from "./AnkiImport";

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it("keeps the existing file-preview-import path working alongside export guidance", async () => {
  const opened = { plan: { decks: [{ name: "Chinese", cards: [{}, {}], reviewed: 1 }], suspended: 0, skipped: 0 } };
  openAnkiFile.mockResolvedValueOnce(opened);
  importDeck.mockResolvedValueOnce({ created: 2, duplicates: 0, mediaFailed: 0 });
  const onImported = vi.fn();
  render(<AnkiImport onImported={onImported} />);
  const picker = screen.getByLabelText("Have your export? Choose your Anki file");
  expect(picker.getAttribute("accept")).toBe(".apkg,.colpkg");
  expect(screen.getByRole("group", { name: "Where do you use Anki?" })).toBeTruthy();
  const file = new File(["fixture"], "my-deck.apkg");
  fireEvent.change(picker, { target: { files: [file] } });
  await screen.findByRole("list", { name: "Decks in this file" });
  expect(openAnkiFile).toHaveBeenCalledWith(file);
  expect(screen.queryByRole("group", { name: "Where do you use Anki?" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Import 2 cards" }));
  expect((await screen.findByRole("status")).textContent).toContain("Imported 2 cards");
  expect(onImported).toHaveBeenCalledWith({ created: 2, duplicates: 0, mediaFailed: 0 });
});

it("keeps instructions and the picker available after an unreadable file", async () => {
  openAnkiFile.mockRejectedValueOnce(new Error("This file is damaged"));
  render(<AnkiImport onImported={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Have your export? Choose your Anki file"), { target: { files: [new File(["bad"], "bad.apkg")] } });
  expect((await screen.findByRole("alert")).textContent).toContain("This file is damaged");
  expect(screen.getByLabelText("Have your export? Choose your Anki file")).toBeTruthy();
  expect(screen.getByRole("group", { name: "Where do you use Anki?" })).toBeTruthy();
});
