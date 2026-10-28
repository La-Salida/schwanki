import { classDateFromFilename } from "./classPdf";

const MB = 1024 * 1024;
const IMAGE_NAME = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i;
/** Enough for small handwriting on a full whiteboard; larger only slows the upload and the reader. */
const MAX_EDGE = 2400;
const MAX_SOURCE_BYTES = 40 * MB;

/** Screenshots and photos, judged by type first because pasted pictures are often named "image.png". */
export function isImageFile(file: Pick<File, "name" | "type">): boolean {
  return file.type.startsWith("image/") || IMAGE_NAME.test(file.name);
}

/** Class-file rows remember the picked file's name; a picture name marks a screenshot source. */
export function isImageRef(externalRef: string): boolean {
  return IMAGE_NAME.test(externalRef);
}

/**
 * The class date for a picture: a date in its name (teacher exports, "Screenshot 2026-10-27 at…",
 * "IMG_20261027_…"), otherwise the day the file was made. Screenshots are taken during or right
 * after class, so that day is a sound default the learner can still change.
 */
export function imageClassDate(file: Pick<File, "name" | "lastModified">): string {
  const named = classDateFromFilename(file.name);
  if (named) return named;
  const match = /(?:^|\D)(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?!\d)/.exec(file.name);
  if (match) {
    const fromName = classDateFromFilename(`${match[1]}-${match[2]}-${match[3]}`);
    if (fromName) return fromName;
  }
  const made = new Date(file.lastModified || Date.now());
  return `${made.getFullYear()}-${String(made.getMonth() + 1).padStart(2, "0")}-${String(made.getDate()).padStart(2, "0")}`;
}

/** Give a pasted picture a readable name instead of the browser's "image.png". */
export function namePastedImage(file: File, index: number): File {
  if (!/^image\.\w+$/i.test(file.name) && file.name) return file;
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] ?? "png";
  return new File([file], `Pasted screenshot${index > 0 ? ` ${index + 1}` : ""}.${ext}`, { type: file.type, lastModified: Date.now() });
}

/**
 * Shrink a screenshot or photo to a JPEG the picture reader handles well. Transparent PNG areas
 * become white, like the whiteboard behind them. iPhone HEIC photos decode in Safari; other
 * browsers that can't open them get a plain explanation.
 */
export async function prepareClassImage(file: File): Promise<Blob> {
  if (!file.size) throw new Error(`${file.name}: This picture is empty. Choose it again.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name}: Pictures must be under 40 MB.`);
  let image: { width: number; height: number; source: CanvasImageSource; close: () => void };
  try {
    image = await decode(file);
  } catch {
    throw new Error(`${file.name}: This picture couldn't be opened. Take a screenshot (PNG or JPG) and upload that instead.`);
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(`${file.name}: This browser can't prepare pictures. Try another browser.`);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob?.size) throw new Error(`${file.name}: This picture couldn't be prepared. Choose it again.`);
    return blob;
  } finally {
    image.close();
  }
}

async function decode(file: File): Promise<{ width: number; height: number; source: CanvasImageSource; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
    } catch { /* Older Safari can only decode some formats through <img>. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight, source: img, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
