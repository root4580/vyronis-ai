import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  generatePatternMemory,
  type PatternMemoryFeedback,
  type PatternMemorySession,
  type PatternMemoryTrade,
} from "@/lib/trade-coach/pattern-memory"
import type { PlannedVsActualComparison, PreTradePlannedContext } from "@/lib/trade-coach/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { fetchAllRowsPaginated } from "@/lib/trades/fetch-all-paginated"

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

export async function GET() {
  try {
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

    const { rows: trades, error: tradesError } = await fetchAllRowsPaginated<PatternMemoryTrade>(
      (from, to) =>
        supabase
          .from("trades")
          .select(
            "id, direction, result, pnl, emotion, emotion_after, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, to),
    )

    if (tradesError) {
      throw new Error(tradesError.message)
    }

    const tradeRows = trades

    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("trade_coach_feedback")
      .select("trade_id, discipline_score, planned_vs_actual")
      .eq("user_id", user.id)

    let feedback: PatternMemoryFeedback[] = []
    if (feedbackError) {
      if (!isMissingTableError(feedbackError)) {
        throw new Error(feedbackError.message)
      }
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
      .eq("user_id", user.id)
      .not("trade_id", "is", null)

    let sessions: PatternMemorySession[] = []
    if (sessionsError) {
      if (!isMissingTableError(sessionsError)) {
        throw new Error(sessionsError.message)
      }
    } else {
      sessions = (sessionRows || []).map((row) => ({
        trade_id: row.trade_id ? String(row.trade_id) : null,
        planned_context: (row.planned_context || {}) as PreTradePlannedContext,
      }))
    }

    const result = generatePatternMemory({
      trades: tradeRows,
      feedback,
      sessions,
      maxRiskPerTrade,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Pattern memory error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build pattern memory" },
      { status: 500 },
    )
  }
}
