import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const { loadCardMedia } = vi.hoisted(() => ({ loadCardMedia: vi.fn() }));
vi.mock("@/lib/mnemonic", () => ({ loadCardMedia }));
import { MnemonicMedia } from "./MnemonicMedia";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows one review example instead of duplicating the original mixed-language sentence", async () => {
  loadCardMedia.mockResolvedValue({ sentence: { text: "猫有腹肌。", translation: "The cat has abs." } });
  render(<MnemonicMedia cardId="c1" word="腹肌" sourceExample="我腹肌已经很明显 obvious 了！" />);
  expect(await screen.findByText("The cat has abs.")).toBeTruthy();
  expect(screen.queryByText(/obvious/)).toBeNull();
  expect(document.querySelectorAll("mark")).toHaveLength(1);
});
it("keeps the original example visible when no review sentence exists", async () => {
  loadCardMedia.mockResolvedValue({ imageUrl: "/image.png" });
  render(<MnemonicMedia cardId="c1" word="腹肌" sourceExample="猫有腹肌。" />);
  expect(await screen.findByAltText("mnemonic scene")).toBeTruthy();
  expect(screen.getByText("猫有腹肌。")).toBeTruthy();
});
