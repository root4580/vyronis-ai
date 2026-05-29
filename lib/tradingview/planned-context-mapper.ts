import type { PreTradeAnalysis, PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { TradingViewSignalAnalysis } from "@/lib/tradingview/types"

export function mapAnalysisToCoachAnalysis(analysis: TradingViewSignalAnalysis): PreTradeAnalysis {
  const shouldTakeTrade =
    analysis.setup_verdict === "trade_ready" || analysis.setup_verdict === "tradable"
      ? "yes"
      : analysis.setup_verdict === "low_quality"
        ? "no"
        : "caution"

  return {
    confidenceScore: analysis.confidence_score,
    shouldTakeTrade,
    summary: analysis.verdict_summary || analysis.summary,
    redFlags: analysis.warnings.map((message) => ({
      id: "emotional_risk" as const,
      severity: "warning" as const,
      message,
    })),
    insights: [
      `War Room grade: ${analysis.setup_grade} (${analysis.setup_verdict.replace(/_/g, " ")})`,
      ...(analysis.why_engine?.recommendation ? [analysis.why_engine.recommendation] : []),
      ...analysis.war_room.notes.slice(0, 2),
      ...analysis.strengths.slice(0, 2),
      ...analysis.warnings.slice(0, 3),
    ].slice(0, 8),
  }
}

export function buildPlannedContextFromSignal(input: {
  signalId: string
  symbol: string
  direction: "BUY" | "SELL"
  timeframe?: string | null
  strategy_name?: string | null
  entry_zone?: string | null
  entry_price?: string | null
  stop_loss?: number | null
  take_profit?: number | null
  message?: string | null
  chart_url?: string | null
  analysis: TradingViewSignalAnalysis
  maxRiskPerTrade?: number
}): PreTradePlannedContext {
  return {
    pair: input.symbol,
    direction: input.direction,
    strategy_name: input.strategy_name,
    entry_price: input.entry_price ?? undefined,
    stop_loss: input.stop_loss != null ? String(input.stop_loss) : undefined,
    take_profit: input.take_profit != null ? String(input.take_profit) : undefined,
    entry_timeframe: input.timeframe || undefined,
    confirmation_signal: input.message || input.strategy_name || "TradingView alert",
    chart_url: input.chart_url || undefined,
    screenshot_url: input.chart_url || null,
    signal_source: "tradingview",
    tradingview_signal_id: input.signalId,
    max_risk_per_trade: input.maxRiskPerTrade,
    coach_analysis: mapAnalysisToCoachAnalysis(input.analysis),
    tradingview_setup_grade: input.analysis.setup_grade,
    tradingview_setup_verdict: input.analysis.setup_verdict,
    tradingview_verdict_summary: input.analysis.verdict_summary,
    tradingview_chart_vision: input.analysis.chart_vision,
    tradingview_why_engine: input.analysis.why_engine,
  }
}
