export type {
  ChartVisionBreakoutState,
  ChartVisionInput,
  ChartVisionMetrics,
  ChartVisionProvider,
  ChartVisionProviderId,
  ChartVisionResult,
  ChartVisionTrendBias,
  ChartVisionVolatility,
} from "@/lib/coach/types"

export {
  analyzeChartVision,
  analyzeChartVisionForContext,
  buildChartVisionMessages,
  chartVisionToLegacyAnalysis,
  isChartVisionResult,
  normalizeChartVision,
  resolveChartVisionProvider,
} from "@/lib/coach/chart-vision-engine"

export { heuristicVisionProvider } from "@/lib/coach/vision-adapters/heuristic-adapter"
export type {
  MtfAnalysisResult,
  MtfBiasAnalysis,
  MtfBiasDirection,
  MtfEntryAnalysis,
  MtfScreenshotMap,
} from "@/lib/coach/mtf-types"

export { MTF_SLOTS, MTF_TIMEFRAME_IDS, buildMtfStoragePath } from "@/lib/coach/mtf-constants"

export {
  analyzeMultiTimeframeVision,
  analyzeMtfBias,
  analyzeMtfEntry,
  buildMtfAnalysisMessages,
  mtfAnalysisToChartAnalysis,
} from "@/lib/coach/multi-timeframe-vision-engine"

export {
  analyzeMultiTimeframeWithVision,
  buildVisualAnalysisMessages,
} from "@/lib/coach/visual-mtf-engine"

export type {
  TimeframeVisualAnalysis,
  VisualAnalysisAggregate,
  VisualAnalysisResult,
  VisualPlaybookComparison,
} from "@/lib/coach/visual-analysis-types"

export { isOpenAiVisionConfigured, isAiProviderConfigured, getProviderDisplayLabel } from "@/lib/ai/providers"
