import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppNav } from "./AppNav";

afterEach(cleanup);
it("identifies the current page and provides a skip link", () => {
  render(<MemoryRouter initialEntries={["/sources"]}><AppNav /></MemoryRouter>);
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Decks & notes" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content");
  const brand = screen.getByRole("link", { name: "Schwanki" });
  expect(brand.querySelector("img")?.getAttribute("src")).toBe("/goose.png");
  expect(brand.textContent).toBe("Schwanki");
});
