// Vendored single-file build of pdf.js (pdfjs-dist@4.10.38 legacy/build/pdf.min.mjs).
// A local file is bundled by reachability; the npm: specifier would make the
// Supabase CLI bundle the ENTIRE pdfjs-dist package (~30 MB) and blow the
// 20 MB function size limit (413 on deploy).
import { getDocument } from "./pdfjs.min.mjs";

// pdf.js touches DOM globals on some code paths even for plain text extraction.
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {};
}

/** Extract readable text from a PDF, one line per text run (EOL-aware). */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({
    data: bytes,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        if ("hasEOL" in item && item.hasEOL) text += "\n";
      }
      pages.push(text);
    }
    return pages.join("\n");
  } finally {
    await doc.destroy();
  }
}
