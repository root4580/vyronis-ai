import { buildEmptyPlannedContext } from "@/lib/trade-coach/planned-context"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { buildPlannedContextFromSignal } from "@/lib/tradingview/planned-context-mapper"
import type { TradingViewSignalListItem } from "@/lib/tradingview/types"

/** Instant planned context from bell list item while full coach session loads. */
export function buildPlannedContextFromSignalItem(
  signal: TradingViewSignalListItem,
  maxRiskPerTrade?: number,
): PreTradePlannedContext {
  const direction = signal.direction === "SELL" ? "SELL" : "BUY"
  if (signal.ai_analysis) {
    return buildPlannedContextFromSignal({
      signalId: signal.id,
      symbol: signal.symbol,
      direction,
      timeframe: signal.timeframe,
      strategy_name: signal.strategy_name,
      message: signal.message,
      chart_url: null,
      analysis: signal.ai_analysis,
      maxRiskPerTrade,
    })
  }
  return {
    ...buildEmptyPlannedContext(),
    pair: signal.symbol,
    direction,
    strategy_name: signal.strategy_name,
    entry_timeframe: signal.timeframe || undefined,
    signal_source: "tradingview",
    tradingview_signal_id: signal.id,
    max_risk_per_trade: maxRiskPerTrade,
  }
}
