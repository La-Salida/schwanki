export type SourceType = "google_sheet" | "google_doc" | "pdf_upload" | "preply_chat" | "manual";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type SerializedFsrsCard = Record<string, unknown>;

export interface SchwankiCard {
  id: string;
  userId: string;
  sourceId: string | null;
  language: string;
  front: string;
  back: string;
  reading?: string;
  exampleSentence?: string;
  createdAt: string;
}

export interface CardState {
  cardId: string;
  dueAt: string; // ISO
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  fsrs: SerializedFsrsCard;
  lastReviewedAt?: string;
}

export interface Source {
  id: string;
  userId: string;
  type: SourceType;
  externalRef: string;
  label: string;
  language: string;
  lastSyncedAt?: string;
  contentHash?: string;
  status: "active" | "error" | "revoked";
  errorDetail?: string;
}

export interface CandidateCardRow {
  id: string;
  sourceId: string;
  front: string;
  back: string;
  reading?: string;
  exampleSentence?: string;
  rawContext: string;
  status: "pending" | "approved" | "discarded";
  confidence: number;
  parseNotes?: string;
  createdAt: string;
}
