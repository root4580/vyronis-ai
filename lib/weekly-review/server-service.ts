import type { SupabaseClient } from "@supabase/supabase-js"
import { filterTradesForWeek, getWeekRange } from "@/lib/ai/weekly-debrief-engine"
import type {
  WeeklyDebriefCoachSession,
  WeeklyDebriefFeedback,
  WeeklyDebriefTrade,
} from "@/lib/ai/weekly-debrief-types"
import { generatePatternMemory } from "@/lib/trade-coach/pattern-memory"
import {
  buildWeeklyReviewReport,
  enrichWeeklyReviewWithAi,
  weeklyReviewReportToRow,
  weeklyReviewRowToReport,
} from "@/lib/weekly-review/engine"
import type { WeeklyReviewRecord, WeeklyReviewReport } from "@/lib/weekly-review/types"

export { weeklyReviewReportToAiReviewRecord, weeklyReviewRowToAiReviewRecord } from "@/lib/weekly-review/learning-adapter"

export function isMissingWeeklyReviewTableError(
  error: { message?: string; code?: string } | null,
) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return error.code === "42703" || /column .* does not exist/i.test(error.message || "")
}

async function loadTrades(supabase: SupabaseClient, userId: string): Promise<WeeklyDebriefTrade[]> {
  const extendedSelect =
    "id, pair, direction, result, pnl, emotion, emotion_after, setup, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, screenshot_url"
  const basicSelect =
    "id, pair, direction, result, pnl, emotion, setup, strategy_name, session, trade_date, created_at"

  const extendedResult = await supabase
    .from("trades")
    .select(extendedSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (!extendedResult.error) {
    return (extendedResult.data || []) as WeeklyDebriefTrade[]
  }

  if (!isMissingColumnError(extendedResult.error)) {
    throw new Error(extendedResult.error.message)
  }

  const fallback = await supabase
    .from("trades")
    .select(basicSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (fallback.error) throw new Error(fallback.error.message)
  return (fallback.data || []) as WeeklyDebriefTrade[]
}

async function loadFeedback(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeeklyDebriefFeedback[]> {
  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score, planned_vs_actual")
    .eq("user_id", userId)

  if (error) {
    if (isMissingWeeklyReviewTableError(error)) return []
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    trade_id: String(row.trade_id),
    discipline_score: row.discipline_score,
    planned_vs_actual: (row.planned_vs_actual ||
      []) as WeeklyDebriefFeedback["planned_vs_actual"],
  }))
}

async function loadCoachSessions(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeeklyDebriefCoachSession[]> {
  const extendedSelect =
    "id, trade_id, quality_score, quality_grade, recommendation, confidence_score, updated_at"
  const basicSelect = "id, trade_id, updated_at"

  const extendedResult = await supabase
    .from("trade_coach_sessions")
    .select(extendedSelect)
    .eq("user_id", userId)
    .not("trade_id", "is", null)

  let rows: Record<string, unknown>[] | null = extendedResult.data as Record<string, unknown>[] | null

  if (extendedResult.error) {
    if (isMissingWeeklyReviewTableError(extendedResult.error)) return []

    if (!isMissingColumnError(extendedResult.error)) {
      throw new Error(extendedResult.error.message)
    }

    const fallback = await supabase
      .from("trade_coach_sessions")
      .select(basicSelect)
      .eq("user_id", userId)
      .not("trade_id", "is", null)

    if (fallback.error) {
      if (isMissingWeeklyReviewTableError(fallback.error)) return []
      throw new Error(fallback.error.message)
    }

    rows = fallback.data as Record<string, unknown>[] | null
  }

  return (rows || []).map((row) => ({
    id: String(row.id),
    trade_id: row.trade_id ? String(row.trade_id) : null,
    quality_score: (row.quality_score as number | null | undefined) ?? null,
    quality_grade: (row.quality_grade as WeeklyDebriefCoachSession["quality_grade"]) ?? null,
    recommendation: (row.recommendation as WeeklyDebriefCoachSession["recommendation"]) ?? null,
    confidence_score: (row.confidence_score as number | null | undefined) ?? null,
    updated_at: row.updated_at as string,
  }))
}

function previousWeekDisciplineAvg(
  trades: WeeklyDebriefTrade[],
  feedback: WeeklyDebriefFeedback[],
  weekOffset: number,
): number | null {
  const previousRange = getWeekRange(new Date(), weekOffset - 1)
  const previousTrades = filterTradesForWeek(trades, previousRange.start, previousRange.end)
  const previousFeedback = feedback.filter((row) =>
    previousTrades.some((trade) => trade.id === row.trade_id),
  )
  if (previousFeedback.length === 0) return null
  return Math.round(
    previousFeedback.reduce((sum, row) => sum + row.discipline_score, 0) / previousFeedback.length,
  )
}

export async function generateWeeklyReviewForUser(
  supabase: SupabaseClient,
  userId: string,
  weekOffset = 0,
  maxRiskPerTrade = 1,
  options?: { useAiNarrative?: boolean },
): Promise<{ report: WeeklyReviewReport; persisted: boolean; skipped?: boolean }> {
  const [trades, feedback, coachSessions] = await Promise.all([
    loadTrades(supabase, userId),
    loadFeedback(supabase, userId),
    loadCoachSessions(supabase, userId),
  ])

  let report = buildWeeklyReviewReport({
    trades,
    feedback,
    coachSessions,
    maxRiskPerTrade,
    weekOffset,
    previousWeekDisciplineAvg: previousWeekDisciplineAvg(trades, feedback, weekOffset),
  })

  if (options?.useAiNarrative) {
    report = await enrichWeeklyReviewWithAi(report)
  }

  const row = weeklyReviewReportToRow(userId, report)
  const { data, error } = await supabase
    .from("weekly_reviews")
    .upsert(
      {
        ...row,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" },
    )
    .select("*")
    .single()

  if (error) {
    if (isMissingWeeklyReviewTableError(error)) {
      return { report, persisted: false, skipped: true }
    }
    throw new Error(error.message)
  }

  return {
    report: weeklyReviewRowToReport(data as WeeklyReviewRecord),
    persisted: true,
  }
}

export async function fetchWeeklyReviews(
  supabase: SupabaseClient,
  userId: string,
  limit = 6,
): Promise<WeeklyReviewRecord[]> {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingWeeklyReviewTableError(error)) return []
    throw new Error(error.message)
  }

  return (data || []) as WeeklyReviewRecord[]
}

export async function fetchWeeklyReviewForWeek(
  supabase: SupabaseClient,
  userId: string,
  weekOffset = 0,
): Promise<WeeklyReviewRecord | null> {
  const weekRange = getWeekRange(new Date(), weekOffset)
  const weekStart = weekRange.start.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle()

  if (error) {
    if (isMissingWeeklyReviewTableError(error)) return null
    throw new Error(error.message)
  }

  return (data as WeeklyReviewRecord | null) ?? null
}

export async function previewWeeklyReviewForUser(
  supabase: SupabaseClient,
  userId: string,
  weekOffset = 0,
  maxRiskPerTrade = 1,
): Promise<WeeklyReviewReport> {
  const [trades, feedback, coachSessions] = await Promise.all([
    loadTrades(supabase, userId),
    loadFeedback(supabase, userId),
    loadCoachSessions(supabase, userId),
  ])

  return buildWeeklyReviewReport({
    trades,
    feedback,
    coachSessions,
    maxRiskPerTrade,
    weekOffset,
    previousWeekDisciplineAvg: previousWeekDisciplineAvg(trades, feedback, weekOffset),
  })
}
