export type SourceType = "google_sheet" | "google_doc" | "pdf_upload" | "preply_chat" | "manual" | "class_recording";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type SerializedFsrsCard = Record<string, unknown>;

export interface SchwankiCard {
  kind?: "vocabulary" | "phrase" | "grammar" | "correction";
  id: string;
  userId: string;
  sourceId: string | null;
  batchId?: string | null;
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
  recordingId?: string;
  learningItemId?: string;
  classStartedAt?: string;
  kind?: "vocabulary" | "phrase" | "grammar" | "correction";
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

/* ---- Batch listening (spec 2026-10-04) ---- */

/** A lesson batch: all cards approved from one triage group (source + day). */
export interface BatchRow {
  id: string;
  userId: string;
  sourceId: string | null;
  label: string; // triage day label, e.g. "2026-09-30"
  language: string;
  createdAt: string;
}

export interface PackLine {
  speaker: "a" | "b";
  text: string;
  translation: string;
}

export interface PackScript {
  lines: PackLine[];
  words_used: string[]; // card ids the model claims it used
}

export type ListeningPackStatus = "queued" | "ready" | "failed";

export interface ListeningPackRow {
  id: string;
  batchId: string;
  part: number;
  script: PackScript | null;
  audioPath: string | null;
  missingWords: string[]; // fronts that didn't make the cut
  status: ListeningPackStatus;
  createdAt: string;
}

export interface PackWord {
  cardId: string;
  madeIt: boolean;
  front: string;
  reading?: string;
  back: string;
}
