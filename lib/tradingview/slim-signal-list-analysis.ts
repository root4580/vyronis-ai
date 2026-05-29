import type {
  TradingViewSignalAnalysis,
  TradingViewSignalListItem,
} from "@/lib/tradingview/types"

/** Drop heavy vision blobs from bell list payloads. */
export function slimSignalAnalysisForList(
  analysis: TradingViewSignalAnalysis | null | undefined,
): TradingViewSignalAnalysis | null | undefined {
  if (!analysis) return analysis

  const { chart_vision: _chartVision, ...rest } = analysis
  if (!rest.why_engine) return rest

  return {
    ...rest,
    why_engine: {
      ...rest.why_engine,
      confidence_categories: rest.why_engine.confidence_categories.slice(0, 6),
    },
  }
}

export function slimTradingViewSignalListItem(
  row: TradingViewSignalListItem,
): TradingViewSignalListItem {
  if (!row.ai_analysis) return row
  return {
    ...row,
    ai_analysis: slimSignalAnalysisForList(row.ai_analysis) ?? row.ai_analysis,
  }
}
