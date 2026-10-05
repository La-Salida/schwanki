// GENERATED from packages/core/src/types.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { CardKind } from './classes.ts';
export type SourceType = "google_sheet" | "google_doc" | "pdf_upload" | "preply_chat" | "manual" | "class_recording";
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
  kind?: CardKind;
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
  kind?: CardKind;
  recordingId?: string;
  recordingStartedAt?: string;
  recordingLabel?: string;
  learningItemId?: string;
  approvedCardId?: string;
  batchId?: string;
}

export type MediaKind = "sentence" | "image" | "audio";

export interface CardMedia {
  id: string;
  cardId: string;
  generationId: string;
  kind: MediaKind;
  content?: string;      // sentence text (kind='sentence'); undefined for binary kinds
  storagePath?: string;  // bucket path for image/audio
  promptUsed?: string;
  provider?: string;
  createdAt: string;
}

/** Per-source review stats for the teacher dashboard. `due` uses the FSRS rule
 *  (due_at ≤ now, or never reviewed = fresh — fresh counts inside due). */
export interface ReviewGroup {
  sourceId: string | null;
  language: string;
  total: number;
  due: number;
  fresh: number;
}
