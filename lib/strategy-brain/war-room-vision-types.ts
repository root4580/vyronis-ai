import type { BiasDirection } from "@/lib/strategy-brain/types"

export type WarRoomVisionFrame = {
  imageIndex: number
  inferredTimeframe: string
  displayLabel: string
  trendBias: BiasDirection
  summary: string
}

export type WarRoomVisionAutofill = {
  available: boolean
  pair: string
  directional_bias: BiasDirection
  aoi_low: number | null
  aoi_high: number | null
  invalidation: number | null
  weekly_thesis: string
  notes: string
  weekly_bias: BiasDirection
  daily_bias: BiasDirection
  h4_bias: BiasDirection
  confidence: number
  inferredStack: string
  comparisonSummary: string
  frames: WarRoomVisionFrame[]
  setupGrade?: string
  recommendation?: string
}
