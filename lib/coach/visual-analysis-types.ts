import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { ChartAnnotation, ChartAnnotationBundle } from "@/lib/chart-annotations/types"
import type { OpenAiChartAnnotationPayload } from "@/lib/chart-annotations/types"
import type { ChartVisionProviderId } from "@/lib/coach/types"
import type { MtfBiasDirection } from "@/lib/coach/mtf-types"
import type {
  TradeQualityGrade,
  TradeQualityRecommendation,
} from "@/lib/trade-coach/trade-quality-engine"

export type VisualEmaAlignmentState = "aligned" | "mixed" | "counter" | "unknown"

export type VisualShouldTakeVerdict = "yes" | "caution" | "no"

export type TimeframeVisualAnalysis = {
  timeframe: CoachMtfTimeframe
  screenshotUrl: string
  provider: ChartVisionProviderId
  analyzedAt: string
  htfTrendBias: MtfBiasDirection
  trendStrength: number
  bosDetected: boolean
  chochDetected: boolean
  liquiditySweepDetected: boolean
  emaAlignmentScore: number
  emaAlignmentState: VisualEmaAlignmentState
  supplyDemandZones: string[]
  confirmationCandleDetected: boolean
  confirmationCandleQuality: number
  countertrendEntry: boolean
  rrQuality: number
  entryQuality: number
  detectedSetup: string
  structureNotes: string[]
  warnings: string[]
  strengths: string[]
  confidence: number
  summary: string
  structureQuality?: number
  overextended?: boolean
  riskExplanation?: string
  setupGradeReason?: string
  strategyMatchPercent?: number
  /** Raw GPT-4 Vision overlay payloads before Top-Down merge */
  gptAnnotations?: OpenAiChartAnnotationPayload[]
  /** Merged strategy overlays (valid/invalid AOI, countertrend, etc.) */
  annotations?: ChartAnnotation[]
}

export type VisualAnalysisAggregate = {
  overallBias: MtfBiasDirection
  biasAlignmentScore: number
  entryConfirmationScore: number
  h1SetupQuality: number
  m15EntryQuality: number
  trendStrength: number
  bosDetected: boolean
  chochDetected: boolean
  liquiditySweepDetected: boolean
  emaAlignmentScore: number
  supplyDemandPresent: boolean
  confirmationQuality: number
  countertrend: boolean
  rrQuality: number
  entryQuality: number
  visionScore: number
  confidenceScore: number
  tradeQualityScore: number
  tradeQualityGrade: TradeQualityGrade
  recommendation: TradeQualityRecommendation
  shouldTake: VisualShouldTakeVerdict
  warnings: string[]
  strengths: string[]
  summary: string
}

export type VisualPlaybookComparison = {
  playbookId: string
  strategyName: string
  matchScore: number
  setupQualityScore: number
  ruleAdherenceScore: number
  executionTimingScore: number
  setupGrade: TradeQualityGrade
  recommendation: TradeQualityRecommendation
  rulesPassed: string[]
  rulesFailed: string[]
  violations: string[]
  summary: string
}

export type VisualAnalysisResult = {
  version: 1
  provider: ChartVisionProviderId
  model?: string
  analyzedAt: string
  chartsAnalyzed: number
  chartsRequested: number
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>
  aggregate: VisualAnalysisAggregate
  playbookComparison?: VisualPlaybookComparison | null
  chartAnnotations?: ChartAnnotationBundle
}

export type OpenAiTimeframeVisionPayload = {
  htfTrendBias: MtfBiasDirection
  trendStrength: number
  bosDetected: boolean
  chochDetected: boolean
  liquiditySweepDetected: boolean
  emaAlignmentScore: number
  emaAlignmentState: VisualEmaAlignmentState
  supplyDemandZones: string[]
  confirmationCandleDetected: boolean
  confirmationCandleQuality: number
  countertrendEntry: boolean
  rrQuality: number
  entryQuality: number
  detectedSetup: string
  structureNotes: string[]
  warnings: string[]
  strengths: string[]
  confidence: number
  summary: string
  structureQuality?: number
  overextended?: boolean
  riskExplanation?: string
  setupGradeReason?: string
  annotations?: OpenAiChartAnnotationPayload[]
}

export type { OpenAiChartAnnotationPayload } from "@/lib/chart-annotations/types"
