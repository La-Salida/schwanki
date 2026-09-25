import type { SourceType } from "@schwanki/core";

export function detectSourceType(url: string): Extract<SourceType, "google_sheet" | "google_doc"> | null {
  if (/docs\.google\.com\/spreadsheets\//.test(url)) return "google_sheet";
  if (/docs\.google\.com\/document\//.test(url)) return "google_doc";
  return null;
}
