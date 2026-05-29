import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildTradeIntelligenceBundle,
  type IntelligenceTradeRow,
} from "@/lib/intelligence/trade-intelligence-layer"
import type { TradeIntelligenceBundle } from "@/lib/intelligence/trade-intelligence-types"
import { isMissingLearningTableError } from "@/lib/learning/server-service"
import { syncTradeMemoryForTrade } from "@/lib/learning/server-service"
import type { LearningFeedbackRow } from "@/lib/learning/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import type {
  PatternMemoryFeedback,
  PatternMemorySession,
} from "@/lib/trade-coach/pattern-memory"
import type { PlannedVsActualComparison, PreTradePlannedContext } from "@/lib/trade-coach/types"

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

const TRADE_SELECT =
  "id, pair, direction, result, pnl, emotion, emotion_after, setup, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, screenshot_url, entry_timeframe, higher_timeframe, confirmation_timeframe, risk_reward, trade_notes, entry_price, stop_loss, take_profit, setup_score, setup_classification, setup_score_breakdown, setup_coaching_insights, import_source"

async function loadIntelligenceTrades(
  supabase: SupabaseClient,
  userId: string,
): Promise<IntelligenceTradeRow[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(TRADE_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as IntelligenceTradeRow[]
}

async function loadCoachFeedback(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<LearningFeedbackRow | undefined> {
  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, session_id, discipline_score, coaching_summary, feedback_points, planned_vs_actual")
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return undefined
    throw new Error(error.message)
  }

  if (!data) return undefined

  return {
    trade_id: String(data.trade_id),
    session_id: data.session_id ? String(data.session_id) : null,
    discipline_score: data.discipline_score,
    coaching_summary: data.coaching_summary,
    feedback_points: (data.feedback_points || []) as string[],
    planned_vs_actual: (data.planned_vs_actual || []) as LearningFeedbackRow["planned_vs_actual"],
  }
}

async function loadPatternMemoryContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ feedback: PatternMemoryFeedback[]; sessions: PatternMemorySession[] }> {
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score, planned_vs_actual")
    .eq("user_id", userId)

  let feedback: PatternMemoryFeedback[] = []
  if (feedbackError) {
    if (!isMissingTableError(feedbackError)) throw new Error(feedbackError.message)
  } else {
    feedback = (feedbackRows || []).map((row) => ({
      trade_id: String(row.trade_id),
      discipline_score: row.discipline_score,
      planned_vs_actual: (row.planned_vs_actual || []) as PlannedVsActualComparison[],
    }))
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("trade_coach_sessions")
    .select("trade_id, planned_context")
    .eq("user_id", userId)
    .not("trade_id", "is", null)

  let sessions: PatternMemorySession[] = []
  if (sessionsError) {
    if (!isMissingTableError(sessionsError)) throw new Error(sessionsError.message)
  } else {
    sessions = (sessionRows || []).map((row) => ({
      trade_id: row.trade_id ? String(row.trade_id) : null,
      planned_context: (row.planned_context || {}) as PreTradePlannedContext,
    }))
  }

  return { feedback, sessions }
}

async function loadTradeMemorySyncedAt(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("trade_memory")
    .select("updated_at")
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .maybeSingle()

  if (error) {
    if (isMissingLearningTableError(error)) return null
    throw new Error(error.message)
  }

  return data?.updated_at ?? null
}

export async function buildTradeIntelligenceForTrade(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<TradeIntelligenceBundle> {
  const trades = await loadIntelligenceTrades(supabase, userId)
  const trade = trades.find((row) => String(row.id) === String(tradeId))
  if (!trade) throw new Error("Trade not found")

  const { data: settings } = await supabase
    .from("user_settings")
    .select("max_risk_per_trade")
    .eq("user_id", userId)
    .maybeSingle()

  const maxRiskPerTrade =
    settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

  const [coachFeedback, patternContext, syncedAt] = await Promise.all([
    loadCoachFeedback(supabase, userId, tradeId),
    loadPatternMemoryContext(supabase, userId),
    loadTradeMemorySyncedAt(supabase, userId, tradeId),
  ])

  const history = trades.filter((row) => String(row.id) !== String(tradeId))

  return buildTradeIntelligenceBundle({
    trade,
    history,
    feedback: coachFeedback,
    patternFeedback: patternContext.feedback,
    patternSessions: patternContext.sessions,
    maxRiskPerTrade,
    syncedAt,
  })
}

export async function analyzeTradeIntelligence(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
  options?: { persistSetupScore?: boolean; syncMemory?: boolean },
): Promise<{
  bundle: TradeIntelligenceBundle
  memorySync?: Awaited<ReturnType<typeof syncTradeMemoryForTrade>>
  setupScorePersisted?: boolean
}> {
  const bundle = await buildTradeIntelligenceForTrade(supabase, userId, tradeId)

  let memorySync: Awaited<ReturnType<typeof syncTradeMemoryForTrade>> | undefined
  if (options?.syncMemory !== false) {
    memorySync = await syncTradeMemoryForTrade(supabase, userId, tradeId)
    bundle.syncedAt = new Date().toISOString()
    bundle.analysis = memorySync.journal ?? bundle.analysis
  }

  let setupScorePersisted = false
  if (options?.persistSetupScore !== false) {
    const { error } = await supabase
      .from("trades")
      .update({
        setup_score: bundle.setupScore.score,
        setup_classification: bundle.setupScore.classification,
        setup_score_breakdown: bundle.setupScore.breakdown,
        setup_coaching_insights: bundle.setupScore.insights,
      })
      .eq("user_id", userId)
      .eq("id", tradeId)

    if (!error) setupScorePersisted = true
  }

  return { bundle, memorySync, setupScorePersisted }
}
