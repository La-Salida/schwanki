import type { SupabaseClient } from "@supabase/supabase-js";
import { initCardState } from "./fsrs.ts";
import type {
  CandidateCardRow, CardState, ReviewRating, SchwankiCard, SerializedFsrsCard, Source, SourceType,
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

  async listPendingCandidates(): Promise<CandidateCardRow[]> {
    const { data, error } = await this.db
      .from("candidate_cards")
      .select("*")
      .eq("status", "pending")
      .order("confidence", { ascending: true }) // sketchy parses first (§5)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapCandidate);
  }

  async setCandidateStatus(id: string, status: "approved" | "discarded"): Promise<void> {
    const { error } = await this.db.from("candidate_cards").update({ status }).eq("id", id);
    if (error) throw error;
  }

  /** Approve a candidate: insert into cards + initial card_state. Dedup conflicts return 'duplicate'. */
  async approveCandidate(candidate: CandidateCardRow): Promise<"created" | "duplicate"> {
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
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSource(r: any): Source {
  return { id: r.id, userId: r.user_id, type: r.type, externalRef: r.external_ref, label: r.label,
    language: r.language, lastSyncedAt: r.last_synced_at ?? undefined, contentHash: r.content_hash ?? undefined,
    status: r.status, errorDetail: r.error_detail ?? undefined };
}
function mapCandidate(r: any): CandidateCardRow {
  return { id: r.id, sourceId: r.source_id, front: r.front, back: r.back,
    reading: r.reading ?? undefined, exampleSentence: r.example_sentence ?? undefined,
    rawContext: r.raw_context, status: r.status, confidence: r.confidence,
    parseNotes: r.parse_notes ?? undefined, createdAt: r.created_at };
}
function mapCard(r: any): SchwankiCard {
  return { id: r.id, userId: r.user_id, sourceId: r.source_id, language: r.language,
    front: r.front, back: r.back, reading: r.reading ?? undefined,
    exampleSentence: r.example_sentence ?? undefined, createdAt: r.created_at };
}
function mapState(r: any): CardState {
  return { cardId: r.card_id, dueAt: r.due_at, stability: r.stability, difficulty: r.difficulty,
    reps: r.reps, lapses: r.lapses, fsrs: r.fsrs, lastReviewedAt: r.last_reviewed_at ?? undefined };
}
