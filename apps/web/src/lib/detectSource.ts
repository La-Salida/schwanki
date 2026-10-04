import type { SourceType } from "@schwanki/core";

export type DetectedSourceType = Extract<SourceType, "google_sheet" | "google_doc"> | "canva";

const CANVA_RE = /(?:^|\/\/)(?:www\.)?canva\.com\/design\//;

export function detectSourceType(url: string): DetectedSourceType | null {
  if (/docs\.google\.com\/spreadsheets\//.test(url)) return "google_sheet";
  if (/docs\.google\.com\/document\//.test(url)) return "google_doc";
  if (CANVA_RE.test(url)) return "canva";
  return null;
}

/** Is this external_ref a Canva design link? (pdf_upload rows store either a Canva URL or a filename.) */
export function isCanvaRef(externalRef: string): boolean {
  return CANVA_RE.test(externalRef);
}
