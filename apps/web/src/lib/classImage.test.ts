import { afterEach, describe, expect, it, vi } from "vitest";
import { imageClassDate, isImageFile, isImageRef, namePastedImage, prepareClassImage } from "./classImage";
import { prepareClassDocument } from "./classDocument";

function stubCanvas() {
  const drawImage = vi.fn();
  const canvases: HTMLCanvasElement[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this);
    return { fillRect: vi.fn(), drawImage, fillStyle: "", imageSmoothingQuality: "low" } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback: BlobCallback, type?: string) {
    callback(new Blob(["jpeg"], { type: type ?? "image/png" }));
  });
  return { drawImage, canvases };
}

function stubBitmap(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width, height, close })));
  return close;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("class pictures", () => {
  it("recognizes screenshots by type or name, including pasted and HEIC pictures", () => {
    expect(isImageFile(new File(["x"], "image.png", { type: "image/png" }))).toBe(true);
    expect(isImageFile(new File(["x"], "IMG_0042.HEIC", { type: "" }))).toBe(true);
    expect(isImageFile(new File(["x"], "26-10-23.pdf", { type: "application/pdf" }))).toBe(false);
    expect(isImageRef("Screenshot 2026-10-27 at 10.15.32.png")).toBe(true);
    expect(isImageRef("26-10-23.pptx")).toBe(false);
    expect(isImageRef("https://www.canva.com/design/abc/view")).toBe(false);
  });

  it("dates a picture from its name, or from the day it was made", () => {
    expect(imageClassDate({ name: "26-10-23_board.png", lastModified: 0 })).toBe("2026-10-23");
    expect(imageClassDate({ name: "Screenshot 2026-10-27 at 10.15.32.png", lastModified: 0 })).toBe("2026-10-27");
    expect(imageClassDate({ name: "IMG_20261026_101530.jpg", lastModified: 0 })).toBe("2026-10-26");
    expect(imageClassDate({ name: "IMG_4567.PNG", lastModified: new Date(2026, 9, 25, 21, 30).getTime() })).toBe("2026-10-25");
  });

  it("names pasted pictures readably and leaves real names alone", () => {
    expect(namePastedImage(new File(["x"], "image.png", { type: "image/png" }), 0).name).toBe("Pasted screenshot.png");
    expect(namePastedImage(new File(["x"], "image.jpeg", { type: "image/jpeg" }), 1).name).toBe("Pasted screenshot 2.jpg");
    expect(namePastedImage(new File(["x"], "board.png", { type: "image/png" }), 0).name).toBe("board.png");
  });

  it("shrinks a large screenshot to a white-backed JPEG no wider than 2400px", async () => {
    const { drawImage, canvases } = stubCanvas();
    const close = stubBitmap(4800, 3000);
    const result = await prepareClassImage(new File(["png"], "board.png", { type: "image/png" }));
    expect(result.type).toBe("image/jpeg");
    expect(canvases[0]!.width).toBe(2400);
    expect(canvases[0]!.height).toBe(1500);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2400, 1500);
    expect(close).toHaveBeenCalled();
  });

  it("keeps small screenshots at their own size", async () => {
    const { canvases } = stubCanvas();
    stubBitmap(1179, 2556);
    await prepareClassDocument(new File(["png"], "IMG_4567.PNG", { type: "image/png" }));
    expect(canvases[0]!.width).toBe(1107);
    expect(canvases[0]!.height).toBe(2400);
  });

  it("explains pictures the browser can't open", async () => {
    stubCanvas();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("unsupported"); }));
    // jsdom has no image decoding; browsers reject undecodable files the same way.
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: () => Promise.reject(new Error("unsupported")) });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    await expect(prepareClassImage(new File(["heic"], "IMG_1.HEIC", { type: "image/heic" })))
      .rejects.toThrow("IMG_1.HEIC: This picture couldn't be opened. Take a screenshot (PNG or JPG) and upload that instead.");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
  });

  it("rejects empty and oversized pictures before decoding", async () => {
    await expect(prepareClassImage(new File([], "a.png", { type: "image/png" }))).rejects.toThrow("empty");
    const huge = new File(["x"], "b.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: 41 * 1024 * 1024 });
    await expect(prepareClassImage(huge)).rejects.toThrow("under 40 MB");
  });
});
