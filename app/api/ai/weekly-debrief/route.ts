import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildWeeklyDebrief,
  filterTradesForWeek,
  getWeekRange,
} from "@/lib/ai/weekly-debrief-engine"
import type {
  WeeklyDebriefCoachSession,
  WeeklyDebriefFeedback,
  WeeklyDebriefTrade,
} from "@/lib/ai/weekly-debrief-types"
import {
  generatePatternMemory,
  type PatternMemoryFeedback,
  type PatternMemoryTrade,
} from "@/lib/trade-coach/pattern-memory"
import type { PlannedVsActualComparison } from "@/lib/trade-coach/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

export async function GET(request: NextRequest) {
  try {
    const weekOffset = Number(request.nextUrl.searchParams.get("weekOffset") ?? "0")
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", user.id)
      .maybeSingle()

    const maxRiskPerTrade =
      settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

    const weekRange = getWeekRange(new Date(), Number.isFinite(weekOffset) ? weekOffset : 0)
    const previousWeekRange = getWeekRange(new Date(), (Number.isFinite(weekOffset) ? weekOffset : 0) - 1)

    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select(
        "id, pair, direction, result, pnl, emotion, emotion_after, setup, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, screenshot_url",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (tradesError) throw new Error(tradesError.message)

    const tradeRows = (trades || []) as WeeklyDebriefTrade[]

    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("trade_coach_feedback")
      .select("trade_id, discipline_score, planned_vs_actual")
      .eq("user_id", user.id)

    let feedback: WeeklyDebriefFeedback[] = []
    if (!feedbackError) {
      feedback = (feedbackRows || []).map((row) => ({
        trade_id: String(row.trade_id),
        discipline_score: row.discipline_score,
        planned_vs_actual: (row.planned_vs_actual || []) as PlannedVsActualComparison[],
      }))
    } else if (!isMissingTableError(feedbackError)) {
      throw new Error(feedbackError.message)
    }

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("trade_coach_sessions")
      .select(
        "id, trade_id, quality_score, quality_grade, recommendation, confidence_score, updated_at",
      )
      .eq("user_id", user.id)
      .not("trade_id", "is", null)

    let coachSessions: WeeklyDebriefCoachSession[] = []
    if (!sessionsError) {
      coachSessions = (sessionRows || []).map((row) => ({
        id: String(row.id),
        trade_id: row.trade_id ? String(row.trade_id) : null,
        quality_score: row.quality_score,
        quality_grade: row.quality_grade,
        recommendation: row.recommendation,
        confidence_score: row.confidence_score,
        updated_at: row.updated_at,
      }))
    } else if (!isMissingTableError(sessionsError)) {
      throw new Error(sessionsError.message)
    }

    const patternInputTrades = tradeRows as PatternMemoryTrade[]
    const patternFeedback = feedback as PatternMemoryFeedback[]
    const patternResult = generatePatternMemory({
      trades: patternInputTrades,
      feedback: patternFeedback,
      sessions: [],
      maxRiskPerTrade,
    })

    const previousWeekTrades = filterTradesForWeek(
      tradeRows,
      previousWeekRange.start,
      previousWeekRange.end,
    )
    const previousFeedback = feedback.filter((row) =>
      previousWeekTrades.some((trade) => trade.id === row.trade_id),
    )
    const previousWeekDisciplineAvg =
      previousFeedback.length > 0
        ? Math.round(
            previousFeedback.reduce((sum, row) => sum + row.discipline_score, 0) /
              previousFeedback.length,
          )
        : null

    const debrief = buildWeeklyDebrief({
      trades: tradeRows,
      feedback,
      coachSessions,
      patterns: patternResult.patterns,
      maxRiskPerTrade,
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
      previousWeekDisciplineAvg,
    })

    debrief.weekLabel = weekRange.label

    return NextResponse.json(debrief)
  } catch (error) {
    console.error("Weekly debrief error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build weekly debrief" },
      { status: 500 },
    )
  }
}
