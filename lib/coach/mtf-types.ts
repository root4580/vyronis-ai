import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { TradeQualityRecommendation } from "@/lib/trade-coach/trade-quality-engine"

export type MtfBiasDirection = "bullish" | "bearish" | "neutral" | "mixed"

export type MtfBiasAnalysis = {
  weeklyBias: MtfBiasDirection
  dailyBias: MtfBiasDirection
  h4Bias: MtfBiasDirection
  overallBias: MtfBiasDirection
  biasAlignmentScore: number
  biasWarnings: string[]
}

export type MtfEntryAnalysis = {
  h1SetupQuality: number
  m15EntryQuality: number
  entryConfirmationScore: number
  entryWarnings: string[]
  entryStrengths: string[]
}

export type MtfScreenshotMap = Partial<Record<CoachMtfTimeframe, string | null>>

export type MtfAnalysisResult = {
  version: 1 | 2
  bias: MtfBiasAnalysis
  entry: MtfEntryAnalysis
  chartsProvided: number
  chartsMissing: CoachMtfTimeframe[]
  confidencePenalty: number
  overallScore: number
  visionScore: number
  recommendation: TradeQualityRecommendation
  summary: string
  analyzedAt: string
  provider?: import("@/lib/coach/types").ChartVisionProviderId
  visualAnalysis?: import("@/lib/coach/visual-analysis-types").VisualAnalysisResult | null
  playbookMatch?: import("@/lib/strategy/types").StrategyPlaybookMatchResult | null
}
