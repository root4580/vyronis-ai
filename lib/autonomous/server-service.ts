import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutonomousIntelligenceSnapshot, ShadowAssessment } from "@/lib/autonomous/types"
import type { TradeReflection } from "@/lib/autonomous/types"
import type { PatternFingerprintCluster } from "@/lib/autonomous/types"
import type { TraderDnaProfile } from "@/lib/autonomous/types"

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  const msg = String(error.message || "").toLowerCase()
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  )
}

export async function persistTraderDna(
  supabase: SupabaseClient,
  userId: string,
  dna: TraderDnaProfile,
): Promise<void> {
  const { error } = await supabase.from("trader_dna_profiles").upsert(
    {
      user_id: userId,
      version: dna.version,
      dna,
      weekly_insight: dna.weeklyInsight,
      confidence_score: dna.confidenceScore,
      computed_at: dna.computedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (error && !isMissingTableError(error)) throw new Error(error.message)
}

export async function persistShadowAssessment(
  supabase: SupabaseClient,
  userId: string,
  shadow: ShadowAssessment,
  meta?: {
    coachSessionId?: string | null
    tradeId?: string | null
    triggerSource?: string
  },
): Promise<void> {
  const { error } = await supabase.from("shadow_assessments").insert({
    user_id: userId,
    coach_session_id: meta?.coachSessionId ?? null,
    trade_id: meta?.tradeId ?? null,
    trigger_source: meta?.triggerSource ?? "api",
    assessment: shadow,
    emotional_risk_score: shadow.emotionalRiskScore,
    discipline_confidence: shadow.disciplineConfidence,
    execution_quality_prediction: shadow.executionQualityPrediction,
    proactive_message: shadow.proactiveMessage,
  })
  if (error && !isMissingTableError(error)) throw new Error(error.message)
}

export async function persistPatternFingerprints(
  supabase: SupabaseClient,
  userId: string,
  clusters: PatternFingerprintCluster[],
): Promise<void> {
  if (clusters.length === 0) return
  const rows = clusters.map((c) => ({
    user_id: userId,
    cluster_key: c.clusterKey,
    cluster_type: c.clusterType,
    label: c.label,
    fingerprint: c.fingerprint,
    occurrence_count: c.occurrenceCount,
    avg_rr: c.avgRr,
    match_score_baseline: c.matchScoreBaseline,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from("pattern_fingerprints").upsert(rows, {
    onConflict: "user_id,cluster_key",
  })
  if (error && !isMissingTableError(error)) throw new Error(error.message)
}

export async function persistLessonMemory(
  supabase: SupabaseClient,
  userId: string,
  reflection: TradeReflection,
  meta?: { tradeId?: string; coachSessionId?: string },
): Promise<void> {
  const { error } = await supabase.from("lesson_memory").insert({
    user_id: userId,
    trade_id: meta?.tradeId ?? null,
    coach_session_id: meta?.coachSessionId ?? null,
    lesson: reflection.lesson,
    category: reflection.category,
    reflection,
  })
  if (error && !isMissingTableError(error)) throw new Error(error.message)
}

export async function syncAutonomousPersistence(
  supabase: SupabaseClient,
  userId: string,
  snapshot: AutonomousIntelligenceSnapshot,
  options?: { persistShadow?: boolean; coachSessionId?: string },
): Promise<void> {
  await persistTraderDna(supabase, userId, snapshot.traderDna)
  if (snapshot.patternClusters.length > 0) {
    await persistPatternFingerprints(supabase, userId, snapshot.patternClusters)
  }
  if (options?.persistShadow) {
    await persistShadowAssessment(supabase, userId, snapshot.shadow, {
      coachSessionId: options.coachSessionId,
      triggerSource: "pre_trade",
    })
  }
}

export async function loadRecentLessons(
  supabase: SupabaseClient,
  userId: string,
  limit = 5,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("lesson_memory")
    .select("lesson")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => String(r.lesson))
}
