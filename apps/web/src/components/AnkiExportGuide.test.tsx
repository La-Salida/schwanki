import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AnkiExportGuide } from "./AnkiExportGuide";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows the desktop export steps and the settings needed to keep history and media", () => {
  render(<AnkiExportGuide />);
  const guide = screen.getByRole("region", { name: "Export from Anki on your computer" });
  expect(within(guide).getAllByRole("listitem")).toHaveLength(4);
  expect(within(guide).getByText(/Include scheduling information and Include media/)).toBeTruthy();
  expect(within(guide).getByText(/preview the cards before importing/)).toBeTruthy();
});

it.each([
  ["iPhone", "iPhone / iPad"],
  ["Android", "Android"],
])("starts with the right instructions on %s", (userAgent, label) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  render(<AnkiExportGuide />);
  expect(screen.getByRole("radio", { name: label })).toHaveProperty("checked", true);
});

it("lets learners switch devices and explains the account-export route", () => {
  render(<AnkiExportGuide />);
  fireEvent.click(screen.getByRole("radio", { name: "iPhone / iPad" }));
  expect(screen.getByText(/tap Add\/Export at the bottom/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /Official Anki instructions/ }).getAttribute("href")).toContain("ankimobile");
  fireEvent.click(screen.getByRole("radio", { name: "Android" }));
  expect(screen.getByText(/Press and hold the deck/)).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "AnkiWeb" }));
  expect(screen.getByText(/Direct AnkiWeb account import isn’t available/)).toBeTruthy();
  expect(screen.getByText(/sign in to the same AnkiWeb account when you sync/)).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("keeps radio selections independent when more than one importer is present", () => {
  render(<><AnkiExportGuide /><AnkiExportGuide /></>);
  const groups = screen.getAllByRole("group", { name: "Where do you use Anki?" });
  fireEvent.click(within(groups[0]!).getByRole("radio", { name: "Android" }));
  expect(within(groups[0]!).getByRole("radio", { name: "Android" })).toHaveProperty("checked", true);
  expect(within(groups[1]!).getByRole("radio", { name: "Computer" })).toHaveProperty("checked", true);
});
