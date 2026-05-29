import { getMarketBias, getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeTradingViewSignal } from "@/lib/tradingview/signal-analysis-engine"
import { applyWarRoomGrading } from "@/lib/tradingview/signal-war-room-grader"
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

  return applyWarRoomGrading({
    symbol: input.symbol,
    direction: input.direction,
    technical,
    weekPlan,
    marketBias,
  })
}
