import type { SupabaseClient } from "@supabase/supabase-js"
import { filterTradesForWeek, getWeekRange } from "@/lib/ai/weekly-debrief-engine"
import {
  loadWeeklyDebriefCoachSessions,
  loadWeeklyDebriefFeedback,
  loadWeeklyDebriefTrades,
} from "@/lib/ai/weekly-debrief-queries"
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

function previousWeekDisciplineAvg(
  trades: import("@/lib/ai/weekly-debrief-types").WeeklyDebriefTrade[],
  feedback: import("@/lib/ai/weekly-debrief-types").WeeklyDebriefFeedback[],
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
    loadWeeklyDebriefTrades(supabase, userId),
    loadWeeklyDebriefFeedback(supabase, userId),
    loadWeeklyDebriefCoachSessions(supabase, userId),
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
    loadWeeklyDebriefTrades(supabase, userId),
    loadWeeklyDebriefFeedback(supabase, userId),
    loadWeeklyDebriefCoachSessions(supabase, userId),
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
