import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type ChartVisionTrendBias = "bullish" | "bearish" | "neutral" | "mixed"

export type ChartVisionBreakoutState = "breakout" | "retest" | "range" | "unknown"

export type ChartVisionVolatility = "compressed" | "normal" | "expanded"

export type ChartVisionProviderId = "heuristic" | "openai" | "claude" | "gemini" | "anthropic"

export type ChartVisionMetrics = {
  trendDirection: ChartVisionTrendBias
  countertrend: boolean
  rrQuality: number
  impulsiveEntryDistance: number
  emaAlignment: number
  supportResistanceProximity: number
  breakoutVsRetest: ChartVisionBreakoutState
  confirmationCandleQuality: number
  overextendedMove: boolean
  volatilityState: ChartVisionVolatility
}

export type ChartVisionResult = {
  version: 2
  visionScore: number
  detectedSetup: string
  trendBias: ChartVisionTrendBias
  warnings: string[]
  strengths: string[]
  executionQuality: number
  confidence: number
  metrics: ChartVisionMetrics
  provider: ChartVisionProviderId
  analyzedAt: string
  summary: string
  insights: string[]
}

export type ChartVisionInput = {
  screenshotUrl: string
  plannedContext: PreTradePlannedContext
  providerId?: ChartVisionProviderId
  timeframe?: CoachMtfTimeframe
}

export type ChartVisionProvider = {
  id: ChartVisionProviderId
  analyze: (input: ChartVisionInput) => Promise<ChartVisionResult>
}
