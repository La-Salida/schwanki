import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ listSources: vi.fn(), listTeachers: vi.fn() }));
const store = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ api, supabase: {} }));
vi.mock("@/lib/autoGenerate", async (orig) => ({
  ...(await orig<typeof import("@/lib/autoGenerate")>()),
  loadAutoGenerate: store.load, saveAutoGenerate: store.save,
}));
import { AutoGenerateSetting } from "@/components/AutoGenerateSetting";
import { AUTO_OFF, teacherChoices } from "@/lib/autoGenerate";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  api.listSources.mockResolvedValue([
    { label: "Ms. Li · 2026-11-01", language: "zh", type: "pdf_upload" },
    { label: "ms. li", language: "zh", type: "google_doc" },
    { label: "Old Anki deck", language: "zh", type: "anki_deck" },
  ]);
  api.listTeachers.mockResolvedValue([{ id: "t", name: "Kru Somchai", language: "th" }]);
  store.load.mockResolvedValue(AUTO_OFF);
  store.save.mockResolvedValue(undefined);
});

const renderIt = () => render(<MemoryRouter><AutoGenerateSetting /></MemoryRouter>);

it("lists teachers by language, merges dated labels, and leaves Anki decks out", () => {
  const choices = teacherChoices(
    [{ label: "Ms. Li · 2026-11-01", language: "zh", type: "pdf_upload" }, { label: "ms. li", language: "zh", type: "google_doc" },
      { label: "Old Anki deck", language: "zh", type: "anki_deck" }],
    [{ id: "t", name: "Kru Somchai", language: "th" }, { id: "u", name: "No language" }],
  );
  expect(choices).toEqual([{ language: "th", teachers: ["Kru Somchai"] }, { language: "zh", teachers: ["Ms. Li"] }]);
});

it("saves one teacher's deck with the chosen kinds and limit", async () => {
  renderIt();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Ms. Li" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Audio" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /most new words a day/i }), { target: { value: "10" } });
  expect(screen.getByText(/spends at most 10 credits a day/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(store.save).toHaveBeenCalledWith({ decks: ["ms. li|zh"], kinds: ["sentence", "image"], dailyLimit: 10 }));
  expect(await screen.findByText(/new words in these decks get memory aids/i)).toBeTruthy();
});

it("covers a whole language and can be turned off", async () => {
  store.load.mockResolvedValue({ decks: ["*|th"], kinds: ["sentence"], dailyLimit: 25 });
  renderIt();
  const somchai = await screen.findByRole("checkbox", { name: "Kru Somchai" }) as HTMLInputElement;
  expect(somchai.checked && somchai.disabled).toBe(true);
  expect(screen.getByText(/sentences are free for 50 a day/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
  await waitFor(() => expect(store.save).toHaveBeenCalledWith({ decks: [], kinds: ["sentence"], dailyLimit: 25 }));
});
