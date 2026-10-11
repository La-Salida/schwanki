import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { TeacherAvatar } from "./TeacherAvatar";

afterEach(cleanup);

it("tries a new photo after an earlier one failed to load", () => {
  const { container, rerender } = render(<TeacherAvatar name="Ms. Li" photoUrl="https://avatars.preply.com/old.jpg" />);
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("LI");
  rerender(<TeacherAvatar name="Ms. Li" photoUrl="https://avatars.preply.com/new.jpg" />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("https://avatars.preply.com/new.jpg");
});
