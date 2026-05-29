import { getMarketBias, getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeTradingViewSignal } from "@/lib/tradingview/signal-analysis-engine"
import { loadRecentOutcomeLessons } from "@/lib/learning/outcome-lessons-service"
import { loadSignalMemoryTrades } from "@/lib/tradingview/signal-memory-loader"
import { applyWarRoomGrading } from "@/lib/tradingview/signal-war-room-grader"
import { enrichTradingSetupWithVyronisAI } from "@/lib/ai/vyronis-ai-integration"
import { buildTradingViewWhyEngine } from "@/lib/tradingview/why-engine"
import type { TradingViewSignalAnalysis } from "@/lib/tradingview/types"

export async function buildTradingViewSignalAnalysis(
  supabase: SupabaseClient,
  userId: string,
  input: {
    symbol: string
    direction: "BUY" | "SELL"
    timeframe?: string | null
    strategy_name?: string | null
    entry_zone?: string | null
    entry_price?: string | null
    stop_loss?: number | null
    take_profit?: number | null
    confidence?: number | null
    message?: string | null
    preferred_session?: string | null
  },
): Promise<TradingViewSignalAnalysis> {
  const technical = analyzeTradingViewSignal(input)

  let weekPlan = null
  let marketBias = null
  try {
    ;[weekPlan, marketBias] = await Promise.all([
      getWeeklyPlanWithPairs(supabase, userId, getWeekStartSunday()),
      getMarketBias(supabase, userId),
    ])
  } catch {
    // Strategy brain tables optional — fall back to technical-only with neutral war score
  }

  const analysis = applyWarRoomGrading({
    symbol: input.symbol,
    direction: input.direction,
    technical,
    weekPlan,
    marketBias,
  })

  let trades: Awaited<ReturnType<typeof loadSignalMemoryTrades>> = []
  let recentOutcomeLessons: Awaited<ReturnType<typeof loadRecentOutcomeLessons>> = []
  try {
    ;[trades, recentOutcomeLessons] = await Promise.all([
      loadSignalMemoryTrades(supabase, userId),
      loadRecentOutcomeLessons(supabase, userId, 12),
    ])
  } catch {
    // Journal optional
  }

  const why_engine_base = buildTradingViewWhyEngine({
    symbol: input.symbol,
    direction: input.direction,
    analysis,
    trades,
    recentOutcomeLessons,
    planned: {
      pair: input.symbol,
      direction: input.direction,
      strategy_name: input.strategy_name,
      session: technical.session_timing.session,
      confirmation_signal: input.message || input.strategy_name || undefined,
      higher_timeframe: technical.htf_alignment.label,
    },
  })

  const why_engine = await enrichTradingSetupWithVyronisAI({
    symbol: input.symbol,
    direction: input.direction,
    analysis,
    why_engine: why_engine_base,
  })

  return { ...analysis, why_engine }
}
