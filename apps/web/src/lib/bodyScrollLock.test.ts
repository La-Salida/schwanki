import { expect, it } from "vitest";
import { lockBodyScroll } from "./bodyScrollLock";

it("restores the original overflow after nested locks release in either order", () => {
  const before = document.body.style.overflow;
  document.body.style.overflow = "auto";
  const outer = lockBodyScroll();
  const inner = lockBodyScroll();
  outer();
  expect(document.body.style.overflow).toBe("hidden");
  inner();
  expect(document.body.style.overflow).toBe("auto");
  inner();
  expect(document.body.style.overflow).toBe("auto");
  document.body.style.overflow = before;
});
