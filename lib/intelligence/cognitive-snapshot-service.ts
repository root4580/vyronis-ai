import type { SupabaseClient } from "@supabase/supabase-js"
import type { CognitiveIntelligenceSnapshot } from "@/lib/cognitive/types"
import { isMissingLearningTableError } from "@/lib/learning/server-service"
import { buildTraderStateTimeline } from "@/lib/intelligence/trader-state-timeline-engine"

export async function loadRecentCognitiveSnapshots(
  supabase: SupabaseClient,
  userId: string,
  limit = 12,
): Promise<{ snapshot: Record<string, unknown>; created_at: string }[]> {
  const { data, error } = await supabase
    .from("cognitive_snapshots")
    .select("snapshot, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingLearningTableError(error)) return []
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    snapshot: (row.snapshot || {}) as Record<string, unknown>,
    created_at: String(row.created_at),
  }))
}

export async function persistCognitiveSnapshot(
  supabase: SupabaseClient,
  userId: string,
  cognitive: CognitiveIntelligenceSnapshot,
  options?: { tradeId?: string; coachSessionId?: string },
): Promise<void> {
  const { error } = await supabase.from("cognitive_snapshots").insert({
    user_id: userId,
    trade_id: options?.tradeId ?? null,
    coach_session_id: options?.coachSessionId ?? null,
    snapshot: {
      state: cognitive.state,
      confidenceGraph: {
        fakeConfidence: cognitive.confidenceGraph.fakeConfidence,
        hesitationPattern: cognitive.confidenceGraph.hesitationPattern,
        emotionalCertainty: cognitive.confidenceGraph.emotionalCertainty,
      },
      coaching: { mode: cognitive.coaching.mode },
      computedAt: cognitive.computedAt,
    },
  })

  if (error && !isMissingLearningTableError(error)) {
    throw new Error(error.message)
  }
}

export async function loadTraderStateTimeline(
  supabase: SupabaseClient,
  userId: string,
  liveDriftScore?: number,
) {
  const rows = await loadRecentCognitiveSnapshots(supabase, userId, 14)
  return buildTraderStateTimeline(rows, liveDriftScore)
}
