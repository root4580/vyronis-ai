import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { MtfBiasDirection } from "@/lib/coach/mtf-types"

export type ChartAnnotationKind =
  | "aoi_valid"
  | "aoi_invalid"
  | "aoi_zone"
  | "bos"
  | "choch"
  | "liquidity_sweep"
  | "mitigation"
  | "retest"
  | "displacement"
  | "confirmation_candle"
  | "entry_area"
  | "invalidation_zone"
  | "htf_bias"
  | "chase_risk"
  | "countertrend"

export type ChartAnnotationTone = "bullish" | "bearish" | "caution" | "liquidity" | "neutral"

export type ChartOverlayMode = "raw" | "overlay" | "replay"

export type ReplayOverlayMoment = "before_entry" | "entry" | "mistake" | "exit"

export type AnnotationSource = "heuristic" | "gpt4_vision"

export type AoiValidity = "valid" | "invalid" | "neutral"

export type ChartAnnotationPoint = {
  x: number
  y: number
}

export type ChartAnnotation = {
  id: string
  kind: ChartAnnotationKind
  label: string
  tone: ChartAnnotationTone
  confidence: number
  x: number
  y: number
  width: number
  height: number
  source: AnnotationSource
  validity?: AoiValidity
  dashed?: boolean
  commentary?: string
  arrowTo?: ChartAnnotationPoint
  replayMoment?: ReplayOverlayMoment
}

export type TopDownConfidenceBreakdown = {
  htfBiasScore: number
  h4StructureScore: number
  h1CleanlinessScore: number
  m15ConfirmationScore: number
  weightedScore: number
}

export type TimeframeChartUnderstanding = {
  timeframe: CoachMtfTimeframe
  bias: MtfBiasDirection
  structureQuality: number
  setupQuality: number
  aoiDescriptions: string[]
  liquidityDetected: boolean
  confirmationDetected: boolean
  countertrend: boolean
  overextended: boolean
  rrEstimate: number
  strategyMatchPercent?: number
  riskExplanation?: string
  setupGradeReason?: string
  annotations: ChartAnnotation[]
  confidenceBreakdown?: TopDownConfidenceBreakdown
  inferenceSource?: "heuristic" | "gpt4_vision" | "mixed"
}

export type ChartAnnotationBundle = {
  version: 1
  generatedAt: string
  provider: string
  confidenceBreakdown: TopDownConfidenceBreakdown
  inferenceLegend: {
    gpt4Vision: string[]
    heuristic: string[]
  }
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeChartUnderstanding>>
}

export type OpenAiChartAnnotationPayload = {
  kind: string
  label: string
  tone?: string
  confidence?: number
  x: number
  y: number
  width: number
  height: number
  commentary?: string
  arrowTo?: { x: number; y: number }
  replayMoment?: string
  validity?: string
}

export type VisualMistakeKind =
  | "early_entry"
  | "chasing_candle"
  | "weak_m15_confirmation"
  | "no_aoi"
  | "htf_conflict"
  | "emotional_entry"
  | "expansion_entry"
  | "countertrend"

export type VisualMistakePattern = {
  kind: VisualMistakeKind
  label: string
  count: number
  message: string
}

export const TOP_DOWN_INFERENCE_LEGEND = {
  gpt4Vision: [
    "Chart pixel read: BOS/CHOCH location, AOI boxes, liquidity sweeps, displacement candles",
    "Normalized overlay coordinates on the screenshot",
    "Per-candle confirmation close detection on M15",
    "Mitigation/retest zone placement from visible structure",
  ],
  heuristic: [
    "Cross-timeframe stack: Weekly/Daily bias → H4 confirmation → H1 cleanliness → M15 close",
    "Valid vs invalid AOI when zones lack BOS/supply-demand confluence",
    "Countertrend/chase penalties from stored vision flags + warnings",
    "Fallback box positions when GPT coordinates are missing",
  ],
} as const
