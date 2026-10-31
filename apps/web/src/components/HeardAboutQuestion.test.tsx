import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { saveHeardAbout } = vi.hoisted(() => ({ saveHeardAbout: vi.fn() }));
vi.mock("@/lib/account", () => ({ useAccount: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/attribution", async (original) => ({ ...(await original<typeof import("@/lib/attribution")>()), saveHeardAbout }));
import { HeardAboutQuestion } from "./HeardAboutQuestion";

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it("saves the tapped answer for the signed-in user and thanks them", async () => {
  saveHeardAbout.mockResolvedValueOnce(undefined);
  render(<HeardAboutQuestion />);
  fireEvent.click(screen.getByRole("button", { name: "Reddit" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Thanks, that helps."));
  expect(saveHeardAbout).toHaveBeenCalledWith("user-1", "reddit");
});

it("keeps the choices up when saving fails", async () => {
  saveHeardAbout.mockRejectedValueOnce(new Error("offline"));
  render(<HeardAboutQuestion />);
  fireEvent.click(screen.getByRole("button", { name: "A friend" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "A friend" })).toBeTruthy();
});
