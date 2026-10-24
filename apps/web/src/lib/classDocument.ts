import { strFromU8, unzip, type Unzipped } from "fflate";

const MB = 1024 * 1024;
const MAX_UPLOAD_BYTES = 10 * MB;
const SLIDE_PATH = /^ppt\/slides\/slide\d+\.xml$/;

/** Discard presentation media locally; only readable slide text leaves the browser. */
export async function prepareClassDocument(file: File): Promise<Blob> {
  if (/\.pdf$/i.test(file.name)) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`${file.name}: PDFs must be under 10 MB. If you have the original PowerPoint, upload its .pptx file for automatic text extraction.`);
    }
    // The selected document kind, rather than the OS MIME guess, controls parsing.
    return file.type === "application/pdf" ? file : file.slice(0, file.size, "application/pdf");
  }
  if (!/\.pptx$/i.test(file.name)) throw new Error("Choose a PowerPoint .pptx or PDF file. Older .ppt files must be saved as .pptx first.");
  if (file.size > 100 * MB) throw new Error(`${file.name}: PowerPoint files must be under 100 MB.`);

  try {
    const bytes = await readBytes(file);
    let xmlBytes = 0;
    let entries = 0;
    const files = await new Promise<Unzipped>((resolve, reject) => {
      unzip(bytes, {
        filter: ({ name, originalSize }) => {
          if (++entries > 10000) throw new Error("This PowerPoint contains too many files.");
          const needed = name === "ppt/presentation.xml" || name === "ppt/_rels/presentation.xml.rels" || SLIDE_PATH.test(name);
          if (!needed) return false;
          xmlBytes += originalSize;
          if (originalSize > 4 * MB || xmlBytes > 32 * MB) throw new Error("This PowerPoint contains too much slide text to import safely.");
          return true;
        },
      }, (error, result) => error ? reject(error) : resolve(result));
    });
    function xml(path: string): Document {
      if (!files[path]) throw new Error("A slide or its ordering information is missing.");
      const doc = new DOMParser().parseFromString(strFromU8(files[path]), "application/xml");
      if (doc.getElementsByTagName("parsererror").length) throw new Error("The slide XML is damaged.");
      return doc;
    }
    const relations = new Map(elements(xml("ppt/_rels/presentation.xml.rels"), "Relationship")
      .filter((node) => node.getAttribute("TargetMode") !== "External")
      .map((node) => [node.getAttribute("Id"), node.getAttribute("Target")]));
    const slides = elements(xml("ppt/presentation.xml"), "sldId");
    if (!slides.length) throw new Error("The presentation has no slides.");
    const text = slides.map((slide) => {
      const id = Array.from(slide.attributes).find((attr) => attr.localName === "id" && attr.namespaceURI)?.value;
      const target = relations.get(id ?? "");
      if (!target) throw new Error("A slide relationship is missing.");
      const url = new URL(target, "https://presentation.local/ppt/");
      const path = url.pathname.slice(1);
      if (url.origin !== "https://presentation.local" || !SLIDE_PATH.test(path)) throw new Error("A slide relationship is invalid.");
      return elements(xml(path), "p").map((paragraph) =>
        Array.from(paragraph.getElementsByTagName("*")).map((node) =>
          node.localName === "t" ? node.textContent ?? "" : node.localName === "br" ? "\n" : "",
        ).join("").trim(),
      ).filter(Boolean).join("\n");
    }).filter(Boolean).join("\n\n");
    if (!text.trim()) throw new Error("No readable slide text found. This presentation may contain only images; upload a PDF with selectable text instead.");
    const prepared = new Blob([text], { type: "text/plain" });
    if (prepared.size > MAX_UPLOAD_BYTES) throw new Error("The extracted slide text exceeds 10 MB. Split the presentation into smaller class files.");
    return prepared;
  } catch (error) {
    throw new Error(`${file.name}: Could not read this PowerPoint. ${error instanceof Error ? error.message : "Try saving it as a new .pptx file."}`);
  }
}

function elements(doc: Document | Element, localName: string): Element[] {
  return Array.from(doc.getElementsByTagName("*")).filter((node) => node.localName === localName);
}

function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error("The file could not be opened. Choose it again."));
    reader.readAsArrayBuffer(file);
  });
}
