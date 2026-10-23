import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useDialog } from "./useDialog";
afterEach(cleanup);
function Dialog({ close }: { close: () => void }) {
  const ref = useDialog(close);
  return <div role="dialog" ref={ref} tabIndex={-1}><button>First</button><button onClick={close}>Close</button></div>;
}
function Fixture() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open</button>{open && <Dialog close={() => setOpen(false)} />}</>;
}
it("traps Tab inside a dialog, closes with Escape, and restores focus to the opener", () => {
  render(<Fixture />);
  const opener = screen.getByRole("button", { name: "Open" }); opener.focus(); fireEvent.click(opener);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  fireEvent.keyDown(document.activeElement!, { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).toBe("");
});

function AdvancedDialog() {
  const ref = useDialog(() => {});
  return <div ref={ref} role="dialog" tabIndex={-1}><button>Back to review</button><textarea aria-label="Idea" /><details><summary>Advanced options</summary><input aria-label="Hidden model" /></details></div>;
}

it("traps focus among visible controls rather than fields inside collapsed options", () => {
  render(<AdvancedDialog />);
  const first = screen.getByRole("button", { name: "Back to review" });
  const summary = screen.getByText("Advanced options");
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(summary);
  fireEvent.keyDown(summary, { key: "Tab" });
  expect(document.activeElement).toBe(first);
});
