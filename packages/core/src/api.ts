import type { SupabaseClient } from "@supabase/supabase-js";
import { initCardState } from "./fsrs.ts";
import type {
  CandidateCardRow, CardMedia, CardState, MediaKind, ReviewGroup, ReviewRating, SchwankiCard, SerializedFsrsCard, Source, SourceType,
} from "./types.ts";
import type { DueCard } from "./session.ts";

export class SchwankiApi {
  constructor(private db: SupabaseClient) {}

  async listSources(): Promise<Source[]> {
    const { data, error } = await this.db.from("sources").select("*").order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapSource);
  }

  async addSource(input: { type: SourceType; externalRef: string; label: string; language: string }): Promise<Source> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data, error } = await this.db
      .from("sources")
      .insert({ user_id: user.id, type: input.type, external_ref: input.externalRef, label: input.label, language: input.language })
      .select()
      .single();
    if (error) throw error;
    return mapSource(data);
  }

  async updateSource(id: string, patch: { label?: string; language?: string }): Promise<void> {
    const fields: Record<string, string> = {};
    if (patch.label !== undefined) fields.label = patch.label;
    if (patch.language !== undefined) fields.language = patch.language;
    if (Object.keys(fields).length === 0) return;
    const { error } = await this.db.from("sources").update(fields).eq("id", id);
    if (error) throw error;
  }

  /**
   * Remove a source. mode decides the fate of produced content:
   * keep → candidates orphaned (source_id set null by FK), cards untouched
   * drop_pending → pending Inbox candidates deleted first, cards untouched
   * drop_all → pending candidates AND deck cards deleted first
   * Always removes the Storage object (PDFs) and the source row (snapshots cascade).
   */
  async removeSource(id: string, mode: "keep" | "drop_pending" | "drop_all"): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data: source, error: srcErr } = await this.db
      .from("sources").select("id, user_id, type").eq("id", id).single();
    if (srcErr) throw srcErr;
    if (mode !== "keep") {
      const { error } = await this.db.from("candidate_cards").delete()
        .eq("source_id", id).eq("status", "pending");
      if (error) throw error;
    }
    if (mode === "drop_all") {
      const { error } = await this.db.from("cards").delete().eq("source_id", id);
      if (error) throw error;
    }
    if (source?.type === "pdf_upload") {
      const { error } = await this.db.storage.from("source-files")
        .remove([sourceFilePath(user.id, id)]);
      if (error) throw error;
    }
    const { error } = await this.db.from("sources").delete().eq("id", id);
    if (error) throw error;
  }

  async uploadSourcePdf(sourceId: string, file: Blob): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { error } = await this.db.storage.from("source-files")
      .upload(sourceFilePath(user.id, sourceId), file, { upsert: true, contentType: "application/pdf" });
    if (error) throw error;
  }

  async listPendingCandidates(): Promise<CandidateCardRow[]> {
    const { data, error } = await this.db
      .from("candidate_cards")
      .select("*, class_recordings(started_at)")
      .eq("status", "pending")
      .order("confidence", { ascending: true }) // sketchy parses first (§5)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapCandidate);
  }

  async setCandidateStatus(id: string, status: "approved" | "discarded"): Promise<void> {
    const { data: candidate, error: readError } = await this.db.from("candidate_cards").select("recording_id, front, back, reading").eq("id", id).single();
    if (readError) throw readError;
    if (candidate?.recording_id) {
      if (status === "approved") throw new Error("Use transactional class approval");
      const { error } = await this.db.rpc("edit_class_candidate", { p_candidate_id: id, p_front: candidate.front, p_back: candidate.back, p_reading: candidate.reading, p_discard: true });
      if (error) throw error;
      return;
    }
    const { error } = await this.db.from("candidate_cards").update({ status }).eq("id", id);
    if (error) throw error;
  }

  /** Approve a candidate: insert into cards + initial card_state. Dedup conflicts return 'duplicate'. */
  async approveCandidate(candidate: CandidateCardRow): Promise<"created" | "duplicate"> {
    if (candidate.recordingId) {
      const { error: editError } = await this.db.rpc("edit_class_candidate", { p_candidate_id: candidate.id, p_front: candidate.front, p_back: candidate.back, p_reading: candidate.reading ?? null });
      if (editError) throw editError;
      const { data, error } = await this.db.rpc("approve_class_candidate", { p_candidate_id: candidate.id });
      if (error) throw error;
      return data.created ? "created" : "duplicate";
    }
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data: source } = await this.db.from("sources").select("language").eq("id", candidate.sourceId).single();
    const language = source?.language ?? "en";
    const { data: card, error } = await this.db
      .from("cards")
      .insert({
        user_id: user.id, source_id: candidate.sourceId, language,
        front: candidate.front, back: candidate.back,
        reading: candidate.reading ?? null, example_sentence: candidate.exampleSentence ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") { // unique violation = cards_dedup_key
        await this.setCandidateStatus(candidate.id, "discarded");
        return "duplicate";
      }
      throw error;
    }
    const init = initCardState(new Date());
    const { error: stateErr } = await this.db.from("card_state").insert({
      card_id: card.id, user_id: user.id, due_at: init.dueAt.toISOString(), fsrs: init.fsrs,
    });
    if (stateErr) throw stateErr;
    await this.setCandidateStatus(candidate.id, "approved");
    return "created";
  }

  async listDueCards(now: Date, limit = 50): Promise<DueCard[]> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data, error } = await this.db
      .from("cards")
      .select("*, card_state(*)")
      .eq("user_id", user.id)
      .order("created_at");
    if (error) throw error;
    const cutoff = now.toISOString();
    return (data ?? [])
      .map((row) => {
        const rawState = Array.isArray(row.card_state) ? row.card_state[0] : row.card_state;
        return { card: mapCard(row), state: rawState ? mapState(rawState) : null };
      })
      .filter((d) => d.state === null || d.state.dueAt <= cutoff) // null state = new card, always due
      .slice(0, limit);
  }

  /** Per-source totals + FSRS-due counts for the teacher dashboard. */
  async reviewGroups(): Promise<ReviewGroup[]> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data, error } = await this.db
      .from("cards")
      .select("id, source_id, language, card_state(due_at)")
      .eq("user_id", user.id);
    if (error) throw error;
    return groupReviewStats(data ?? [], new Date().toISOString());
  }

  /** Light card refs for deck selection (bulk flows) — no FSRS payload. */
  async listCardRefs(): Promise<Array<{ id: string; front: string; sourceId: string | null; language: string }>> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { data, error } = await this.db.from("cards").select("id, front, source_id, language").eq("user_id", user.id);
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, front: r.front, sourceId: r.source_id, language: r.language }));
  }

  /** Which media kinds already exist per card (skip-existing for bulk). */
  async listMediaKinds(): Promise<Array<{ cardId: string; kind: MediaKind }>> {
    const { data, error } = await this.db.from("card_media").select("card_id, kind");
    if (error) throw error;
    return (data ?? []).map((r) => ({ cardId: r.card_id, kind: r.kind as MediaKind }));
  }

  async saveReview(
    state: CardState,
    event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard; elapsedMs?: number },
  ): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { error: sErr } = await this.db.from("card_state").upsert({
      card_id: state.cardId, user_id: user.id, due_at: state.dueAt,
      stability: state.stability, difficulty: state.difficulty,
      reps: state.reps, lapses: state.lapses, fsrs: state.fsrs,
      last_reviewed_at: state.lastReviewedAt ?? null,
    });
    if (sErr) throw sErr;
    const { error: eErr } = await this.db.from("review_events").insert({
      card_id: event.cardId, user_id: user.id, reviewed_at: event.reviewedAt,
      rating: event.rating, elapsed_ms: event.elapsedMs ?? null,
      fsrs_state_before: event.fsrsStateBefore,
    });
    if (eErr) throw eErr;
  }

  async listCardMedia(cardIds: string[]): Promise<CardMedia[]> {
    if (cardIds.length === 0) return [];
    const { data, error } = await this.db.from("card_media").select("*").in("card_id", cardIds);
    if (error) throw error;
    return (data ?? []).map(mapCardMedia);
  }

  async signedMediaUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.db.storage.from("card-media").createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  async creditBalance(): Promise<number> {
    const { data, error } = await this.db.from("credit_ledger").select("delta");
    if (error) throw error;
    return (data ?? []).reduce((n, r) => n + (r.delta as number), 0);
  }

  async listApiKeyProviders(): Promise<Array<{ provider: string; updatedAt: string }>> {
    const { data, error } = await this.db.from("my_api_key_providers").select("*");
    if (error) throw error;
    return (data ?? []).map((r) => ({ provider: r.provider as string, updatedAt: r.updated_at as string }));
  }

  /** Write-only table: PostgREST upsert fails under this RLS — insert, then update on 23505. */
  async saveApiKey(provider: string, apiKey: string): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const now = new Date().toISOString();
    const ins = await this.db.from("user_api_keys").insert({ user_id: user.id, provider, api_key: apiKey, updated_at: now });
    if (!ins.error) return;
    if (ins.error.code !== "23505") throw ins.error;
    const upd = await this.db.from("user_api_keys")
      .update({ api_key: apiKey, updated_at: now })
      .eq("user_id", user.id).eq("provider", provider);
    if (upd.error) throw upd.error;
  }

  async deleteApiKey(provider: string): Promise<void> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error("not signed in");
    const { error } = await this.db.from("user_api_keys").delete().eq("user_id", user.id).eq("provider", provider);
    if (error) throw error;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Storage object path for a source's PDF: {userId}/{sourceId}.pdf */
export function sourceFilePath(userId: string, sourceId: string): string {
  return `${userId}/${sourceId}.pdf`;
}
function mapSource(r: any): Source {
  return { id: r.id, userId: r.user_id, type: r.type, externalRef: r.external_ref, label: r.label,
    language: r.language, lastSyncedAt: r.last_synced_at ?? undefined, contentHash: r.content_hash ?? undefined,
    status: r.status, errorDetail: r.error_detail ?? undefined };
}
function mapCandidate(r: any): CandidateCardRow {
  return { id: r.id, sourceId: r.source_id, front: r.front, back: r.back,
    ...(r.recording_id ? { recordingId: r.recording_id, learningItemId: r.learning_item_id, kind: r.kind, classStartedAt: r.class_recordings?.started_at ?? r.created_at } : {}),
    reading: r.reading ?? undefined, exampleSentence: r.example_sentence ?? undefined,
    rawContext: r.raw_context, status: r.status, confidence: r.confidence,
    parseNotes: r.parse_notes ?? undefined, createdAt: r.created_at };
}
function mapCard(r: any): SchwankiCard {
  return { kind: r.kind ?? "vocabulary", id: r.id, userId: r.user_id, sourceId: r.source_id, language: r.language,
    front: r.front, back: r.back, reading: r.reading ?? undefined,
    exampleSentence: r.example_sentence ?? undefined, createdAt: r.created_at };
}
function mapState(r: any): CardState {
  return { cardId: r.card_id, dueAt: r.due_at, stability: r.stability, difficulty: r.difficulty,
    reps: r.reps, lapses: r.lapses, fsrs: r.fsrs, lastReviewedAt: r.last_reviewed_at ?? undefined };
}
/** Group raw card rows (with embedded card_state) into per-source review stats. */
export function groupReviewStats(rows: any[], nowIso: string): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const r of rows) {
    const key = `${r.source_id ?? ""}|${r.language ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { sourceId: r.source_id ?? null, language: r.language ?? "", total: 0, due: 0, fresh: 0 };
      groups.set(key, g);
    }
    g.total++;
    const state = Array.isArray(r.card_state) ? r.card_state[0] : r.card_state;
    if (!state || state.due_at <= nowIso) {
      g.due++;
      if (!state) g.fresh++;
    }
  }
  return [...groups.values()];
}
export function mapCardMedia(r: any): CardMedia {
  return { id: r.id, cardId: r.card_id, generationId: r.generation_id, kind: r.kind,
    content: r.content ?? undefined, storagePath: r.storage_path ?? undefined,
    promptUsed: r.prompt_used ?? undefined, provider: r.provider ?? undefined, createdAt: r.created_at };
}
