import type { SupabaseClient } from "@supabase/supabase-js"
import { generatePatternMemory, type PatternMemoryTrade } from "@/lib/trade-coach/pattern-memory"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { TradeQualityHistoricalTrade, TradeQualityInput } from "@/lib/trade-coach/trade-quality-engine"

export async function fetchQualityContext(
  supabase: SupabaseClient,
  userId: string,
  maxRiskPerTrade: number,
): Promise<{
  historicalTrades: TradeQualityHistoricalTrade[]
  patternMemory: ReturnType<typeof generatePatternMemory>
}> {
  const { data: trades } = await supabase
    .from("trades")
    .select(
      "id, direction, result, pnl, emotion, emotion_after, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100)

  const historicalTrades = (trades || []) as TradeQualityHistoricalTrade[]

  const { data: feedbackRows } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score, planned_vs_actual")
    .eq("user_id", userId)

  const { data: sessionRows } = await supabase
    .from("trade_coach_sessions")
    .select("trade_id, planned_context, screenshot_url, vision_score, chart_analysis")
    .eq("user_id", userId)
    .not("trade_id", "is", null)

  const patternMemory = generatePatternMemory({
    trades: (trades || []) as PatternMemoryTrade[],
    feedback: (feedbackRows || []).map((row) => ({
      trade_id: String(row.trade_id),
      discipline_score: row.discipline_score,
      planned_vs_actual: row.planned_vs_actual || [],
    })),
    sessions: (sessionRows || []).map((row) => ({
      trade_id: row.trade_id ? String(row.trade_id) : null,
      planned_context: (row.planned_context || {}) as PreTradePlannedContext,
      screenshot_url: row.screenshot_url ?? null,
      vision_score: row.vision_score ?? null,
      chart_analysis: row.chart_analysis ?? null,
    })),
    maxRiskPerTrade,
  })

  return { historicalTrades, patternMemory }
}

export function buildTradeQualityInput(
  plannedContext: PreTradePlannedContext,
  responses: Record<string, string>,
  maxRiskPerTrade: number,
  historicalTrades: TradeQualityHistoricalTrade[],
  patternMemory: ReturnType<typeof generatePatternMemory>,
): TradeQualityInput {
  return {
    plannedContext,
    responses,
    maxRiskPerTrade,
    historicalTrades,
    patternMemory,
  }
}
