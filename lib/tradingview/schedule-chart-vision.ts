import type { SupabaseClient } from "@supabase/supabase-js"
import { enrichTradingViewSignalChartVision } from "@/lib/tradingview/signal-chart-vision-enrichment"
import type { TradingViewIngestChartVisionContext } from "@/lib/tradingview/webhook-server-service"

export function runTradingViewChartVisionEnrichment(
  supabase: SupabaseClient,
  ctx: TradingViewIngestChartVisionContext,
): void {
  void enrichTradingViewSignalChartVision(supabase, {
    userId: ctx.userId,
    signalId: ctx.signalId,
    coachSessionId: ctx.coachSessionId,
    symbol: ctx.normalized.symbol,
    direction: ctx.normalized.direction,
    timeframe: ctx.normalized.timeframe,
    strategy_name: ctx.normalized.strategy_name,
    entry_zone: ctx.normalized.entry_zone,
    entry_price: ctx.normalized.entry_price,
    stop_loss: ctx.normalized.stop_loss,
    take_profit: ctx.normalized.take_profit,
    message: ctx.normalized.message,
    chart_url: ctx.normalized.chart_url,
    image_url: ctx.image_url,
    screenshot_url: ctx.screenshot_url,
    analysis: ctx.analysis,
    maxRiskPerTrade: ctx.maxRiskPerTrade,
  }).catch((error) => {
    console.error("TradingView chart vision enrichment failed:", error)
  })
}
