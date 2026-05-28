import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { ChartStructureType } from "@/lib/intelligence/chart-review-format"

/** Timeframes the bundle engine can infer from chart text (M5 is analysis-only, not stored on coach session). */
export type InferredBundleTimeframe = CoachMtfTimeframe | "m5" | "unknown"

export const BUNDLE_TIMEFRAME_ORDER: InferredBundleTimeframe[] = [
  "weekly",
  "daily",
  "h4",
  "h1",
  "m15",
  "m5",
]

export const BUNDLE_TIMEFRAME_DISPLAY: Record<InferredBundleTimeframe, string> = {
  weekly: "Weekly",
  daily: "D1",
  h4: "H4",
  h1: "H1",
  m15: "M15",
  m5: "M5",
  unknown: "unknown timeframe",
}

export type TimeframeBundleFrame = {
  imageUrl: string
  index: number
  inferredTimeframe: InferredBundleTimeframe
  displayLabel: string
  trendBias: string
  summary: string
}

export type TimeframeBundleAnalysis = {
  sessionId: string
  imageUrls: string[]
  frames: TimeframeBundleFrame[]
  inferredStack: string
  comparisonSummary: string
  htfAlignment: string
  conflicts: string[]
  aoiQuality: string
  entryTiming: string
  ltfConfirmsHtf: boolean | null
  structureType: ChartStructureType
  mtfAnalysis: MtfAnalysisResult | null
}
