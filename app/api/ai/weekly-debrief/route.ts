import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildWeeklyDebrief,
  filterTradesForWeek,
  getWeekRange,
} from "@/lib/ai/weekly-debrief-engine"
import type { WeeklyDebriefTrade } from "@/lib/ai/weekly-debrief-types"
import {
  loadWeeklyDebriefCoachSessions,
  loadWeeklyDebriefFeedback,
  loadWeeklyDebriefTrades,
} from "@/lib/ai/weekly-debrief-queries"
import {
  generatePatternMemory,
  type PatternMemoryFeedback,
  type PatternMemoryTrade,
} from "@/lib/trade-coach/pattern-memory"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

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

    const [tradeRows, feedback, coachSessions] = await Promise.all([
      loadWeeklyDebriefTrades(supabase, user.id),
      loadWeeklyDebriefFeedback(supabase, user.id),
      loadWeeklyDebriefCoachSessions(supabase, user.id),
    ])

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
