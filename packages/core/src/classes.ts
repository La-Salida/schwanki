export type CardKind = 'vocabulary' | 'phrase' | 'grammar' | 'correction';
export type ClassProcessingState = 'prepared' | 'recording' | 'uploading' | 'queued' | 'transcribing' | 'extracting' | 'ready' | 'interrupted' | 'failed' | 'deleting' | 'deleted';
export interface ClassRecording {
  id: string; userId: string; sourceId: string | null; label: string;
  targetLanguage: string; explanationLanguage: string; state: ClassProcessingState;
  durationMs: number | null; completenessFlags: string[];
  retentionDeadline: string | null; derivedStale: boolean; createdAt: string;
}
export interface ClassTranscriptSegment {
  id: string; transcriptId: string; recordingId: string; sequence: number;
  channel: 'tab' | 'microphone'; startMs: number; endMs: number;
  speakerLabel: string | null; text: string;
  uncertainty: Record<string, unknown>;
}
export interface ClassEvidence { segmentId: string; quote: string }
export interface ClassLearningItem {
  id: string; recordingId: string; noteRevisionId: string; kind: CardKind; targetText: string;
  evidenceContent: Record<string, unknown>; generatedContent: Record<string, unknown>;
  evidence: ClassEvidence[]; reviewFlags: string[];
}
export interface LessonBatch {
  id: string; userId: string; sourceId: string | null; recordingId: string | null;
  label: string; language: string; createdAt: string;
}
export interface ClassApprovalResult { cardId: string; created: boolean; batchId: string }
