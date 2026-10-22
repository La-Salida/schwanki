import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ saveCardExample: vi.fn(), removeCardMedia: vi.fn(), replaceCardFile: vi.fn() }));
vi.mock("./supabase", () => ({ api }));
import { saveManualMedia, validateCardFile } from "./manualMedia";
beforeEach(() => vi.resetAllMocks());
it("saves the sentence before attaching replacement files and respects explicit removal", async () => {
  const image = new File(["pixels"], "abs.png", { type: "image/png" });
  await saveManualMedia("c1", { example: { text: "猫有腹肌。", translation: "The cat has abs." }, image, audio: null });
  expect(api.saveCardExample).toHaveBeenCalledWith("c1", "猫有腹肌。", "The cat has abs.");
  expect(api.replaceCardFile).toHaveBeenCalledWith("c1", "image", { name: image.name, body: image, contentType: image.type });
  expect(api.removeCardMedia).toHaveBeenCalledWith("c1", "audio");
  expect(api.saveCardExample.mock.invocationCallOrder[0]).toBeLessThan(api.replaceCardFile.mock.invocationCallOrder[0]!);
});
it("rejects unusable uploads and propagates save failures", async () => {
  expect(() => validateCardFile("image", new File(["html"], "page.html", { type: "text/html" }))).toThrow("Choose a JPG");
  expect(() => validateCardFile("audio", new File([], "empty.mp3", { type: "audio/mpeg" }))).toThrow("non-empty");
  api.saveCardExample.mockRejectedValue(new Error("offline"));
  await expect(saveManualMedia("c1", { example: { text: "new", translation: "new" }, audio: null })).rejects.toThrow("offline");
  expect(api.removeCardMedia).not.toHaveBeenCalled();
});
