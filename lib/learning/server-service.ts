import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLearningMemorySnapshot } from "@/lib/learning/learning-dashboard"
import {
  buildEmotionalTrends,
  detectRecurringBehaviors,
} from "@/lib/learning/pattern-detection"
import {
  buildTradeMemoryRecord,
  buildTradeMemoryRecords,
} from "@/lib/learning/trade-memory-engine"
import { generateJournalIntelligence, summarizeTradeForMemory } from "@/lib/learning/journal-intelligence"
import { buildSetupStatistics } from "@/lib/learning/winning-patterns"
import { buildPersistedWeeklyReview, enrichWeeklyReviewWithProvider } from "@/lib/learning/weekly-review-service"
import { filterTradesForWeek, getWeekRange } from "@/lib/ai/weekly-debrief-engine"
import type {
  AiReviewRecord,
  JournalIntelligenceResult,
  LearningFeedbackRow,
  LearningTradeRow,
  TradeMemoryRecord,
} from "@/lib/learning/types"

export function isMissingLearningTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

async function loadTrades(supabase: SupabaseClient, userId: string): Promise<LearningTradeRow[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      "id, pair, direction, result, pnl, emotion, emotion_after, setup, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, screenshot_url, entry_timeframe, higher_timeframe, confirmation_timeframe, risk_reward, trade_notes",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as LearningTradeRow[]
}

async function loadFeedback(
  supabase: SupabaseClient,
  userId: string,
): Promise<LearningFeedbackRow[]> {
  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, session_id, discipline_score, coaching_summary, feedback_points, planned_vs_actual")
    .eq("user_id", userId)

  if (error) {
    if (isMissingLearningTableError(error)) return []
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    trade_id: String(row.trade_id),
    session_id: row.session_id ? String(row.session_id) : null,
    discipline_score: row.discipline_score,
    coaching_summary: row.coaching_summary,
    feedback_points: (row.feedback_points || []) as string[],
    planned_vs_actual: (row.planned_vs_actual || []) as LearningFeedbackRow["planned_vs_actual"],
  }))
}

async function loadSessionIdsByTrade(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .select("id, trade_id")
    .eq("user_id", userId)
    .not("trade_id", "is", null)
    .order("updated_at", { ascending: false })

  if (error) {
    if (isMissingLearningTableError(error)) return new Map()
    throw new Error(error.message)
  }

  const map = new Map<string, string>()
  for (const row of data || []) {
    const tradeId = String(row.trade_id)
    if (!map.has(tradeId)) {
      map.set(tradeId, String(row.id))
    }
  }
  return map
}

export async function syncTradeMemoryForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ synced: number; skipped?: boolean }> {
  const trades = await loadTrades(supabase, userId)
  const feedback = await loadFeedback(supabase, userId)
  const sessionIdByTrade = await loadSessionIdsByTrade(supabase, userId)
  const feedbackMap = new Map(feedback.map((row) => [row.trade_id, row]))
  const records = buildTradeMemoryRecords(userId, trades, feedbackMap, sessionIdByTrade)

  if (records.length === 0) return { synced: 0 }

  const { error } = await supabase.from("trade_memory").upsert(
    records.map((record) => ({
      ...record,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "trade_id" },
  )

  if (error) {
    if (isMissingLearningTableError(error)) return { synced: 0, skipped: true }
    throw new Error(error.message)
  }

  await syncEmotionalPatterns(supabase, userId, trades)
  await syncSetupStatistics(supabase, userId, trades)

  return { synced: records.length }
}

export async function syncTradeMemoryForTrade(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<{ synced: boolean; skipped?: boolean; journal?: JournalIntelligenceResult }> {
  const trades = await loadTrades(supabase, userId)
  const trade = trades.find((row) => String(row.id) === String(tradeId))
  if (!trade) throw new Error("Trade not found")

  const feedback = await loadFeedback(supabase, userId)
  const sessionIdByTrade = await loadSessionIdsByTrade(supabase, userId)
  const tradeFeedback = feedback.find((row) => row.trade_id === String(tradeId))
  const history = trades.filter((row) => String(row.id) !== String(tradeId))
  const journal = generateJournalIntelligence({ trade, history, feedback: tradeFeedback })

  const record = buildTradeMemoryRecord({
    userId,
    trade,
    feedback: tradeFeedback,
    sessionId: sessionIdByTrade.get(String(tradeId)) ?? tradeFeedback?.session_id,
    aiSummary: summarizeTradeForMemory(trade, tradeFeedback),
  })
  record.ai_summary = journal.summary

  const { error } = await supabase.from("trade_memory").upsert(
    {
      ...record,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trade_id" },
  )

  if (error) {
    if (isMissingLearningTableError(error)) {
      return { synced: false, skipped: true, journal }
    }
    throw new Error(error.message)
  }

  await syncEmotionalPatterns(supabase, userId, trades)
  await syncSetupStatistics(supabase, userId, trades)

  return { synced: true, journal }
}

async function syncEmotionalPatterns(
  supabase: SupabaseClient,
  userId: string,
  trades: LearningTradeRow[],
) {
  const patterns = detectRecurringBehaviors(trades)
  const emotionalTrends = buildEmotionalTrends(trades)
  const rows = [
    ...patterns.map((pattern) => ({
      user_id: userId,
      pattern_key: pattern.key,
      label: pattern.label,
      category: pattern.category,
      severity: pattern.severity,
      occurrence_count: pattern.count,
      loss_count: 0,
      win_count: 0,
      trend: "stable" as const,
      last_seen_at: new Date().toISOString(),
      metadata: { message: pattern.message },
      updated_at: new Date().toISOString(),
    })),
    ...emotionalTrends.slice(0, 4).map((item) => ({
      user_id: userId,
      pattern_key: `emotion_${item.emotion.toLowerCase()}`,
      label: `${item.emotion} state`,
      category: "emotion",
      severity: item.trend === "risky" ? ("warning" as const) : ("insight" as const),
      occurrence_count: item.count,
      loss_count: 0,
      win_count: 0,
      trend: "stable" as const,
      last_seen_at: new Date().toISOString(),
      metadata: { trend: item.trend },
      updated_at: new Date().toISOString(),
    })),
  ]

  if (rows.length === 0) return

  const { error } = await supabase.from("emotional_patterns").upsert(rows, {
    onConflict: "user_id,pattern_key",
  })
  if (error && !isMissingLearningTableError(error)) throw new Error(error.message)
}

async function syncSetupStatistics(
  supabase: SupabaseClient,
  userId: string,
  trades: LearningTradeRow[],
) {
  const stats = buildSetupStatistics(trades)
  if (stats.length === 0) return

  const rows = stats.map((item) => ({
    user_id: userId,
    ...item,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from("setup_statistics").upsert(rows, {
    onConflict: "user_id,setup_type",
  })
  if (error && !isMissingLearningTableError(error)) throw new Error(error.message)
}

export async function getLearningMemorySnapshot(supabase: SupabaseClient, userId: string) {
  const trades = await loadTrades(supabase, userId)
  const feedback = await loadFeedback(supabase, userId)

  const { data: memories } = await supabase
    .from("trade_memory")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(12)

  const { data: setupStats } = await supabase
    .from("setup_statistics")
    .select("*")
    .eq("user_id", userId)
    .order("win_rate", { ascending: false })

  const { data: emotionalPatterns } = await supabase
    .from("emotional_patterns")
    .select("*")
    .eq("user_id", userId)
    .order("occurrence_count", { ascending: false })

  return buildLearningMemorySnapshot({
    trades,
    feedback,
    memories: (memories || []) as TradeMemoryRecord[],
    setupStats: (setupStats || []) as never[],
    emotionalPatterns: (emotionalPatterns || []) as never[],
  })
}

export async function persistWeeklyReview(
  supabase: SupabaseClient,
  userId: string,
  weekOffset = 0,
  maxRiskPerTrade = 1,
): Promise<{ review: AiReviewRecord; persisted: boolean; skipped?: boolean }> {
  const trades = await loadTrades(supabase, userId)
  const feedback = await loadFeedback(supabase, userId)
  const weekRange = getWeekRange(new Date(), weekOffset)
  const weekTrades = filterTradesForWeek(trades, weekRange.start, weekRange.end)
  let review = buildPersistedWeeklyReview({ trades, feedback, weekOffset, maxRiskPerTrade })
  review = await enrichWeeklyReviewWithProvider(review, weekTrades)

  const { error } = await supabase.from("ai_reviews").upsert(
    {
      user_id: userId,
      review_type: review.review_type,
      week_start: review.week_start,
      week_end: review.week_end,
      summary: review.summary,
      recurring_mistakes: review.recurring_mistakes,
      emotional_trends: review.emotional_trends,
      discipline_score: review.discipline_score,
      most_profitable_setup: review.most_profitable_setup,
      advice: review.advice,
      payload: review.payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,review_type,week_start" },
  )

  if (error) {
    if (isMissingLearningTableError(error)) {
      return { review, persisted: false, skipped: true }
    }
    throw new Error(error.message)
  }

  return { review, persisted: true }
}

export async function getRecentAiReviews(supabase: SupabaseClient, userId: string, limit = 4) {
  const { data, error } = await supabase
    .from("ai_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingLearningTableError(error)) return []
    throw new Error(error.message)
  }
  return data || []
}

export async function buildJournalIntelligenceForTrade(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<JournalIntelligenceResult> {
  const trades = await loadTrades(supabase, userId)
  const trade = trades.find((row) => String(row.id) === String(tradeId))
  if (!trade) throw new Error("Trade not found")
  const feedback = await loadFeedback(supabase, userId)
  const tradeFeedback = feedback.find((row) => row.trade_id === String(tradeId))
  return generateJournalIntelligence({
    trade,
    history: trades.filter((row) => String(row.id) !== String(tradeId)),
    feedback: tradeFeedback,
  })
}
