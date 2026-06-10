/**
 * Vyronis Core Model — centralized strategy doctrine types.
 * Part of Vyronis AI · Vyronis strategy scoring · Vyronis journal intelligence.
 * Modular inputs for TradingView, MT5, screenshot AI, and multi-agent debate layers.
 */

export {
  VYRONIS_AI,
  VYRONIS_CORE_DOCTRINE_ID,
  VYRONIS_CORE_DOCTRINE_VERSION,
  VYRONIS_CORE_MODEL,
  VYRONIS_JOURNAL_INTELLIGENCE,
  VYRONIS_STRATEGY_SCORING,
} from "@/types/vyronis-branding"

export type VyronisEmotionState =
  | "calm"
  | "confident"
  | "fearful"
  | "revenge"
  | "impulsive"
  | "overconfident"

export type VyronisDirection = "long" | "short" | "neutral"

export type VyronisBiasDirection = "bullish" | "bearish" | "neutral"

export type VyronisStructureShift = "choch" | "bos" | "none" | "unverified"

export type VyronisEngulfingType = "bullish" | "bearish" | "none"

export type VyronisSession =
  | "asia"
  | "london"
  | "new_york"
  | "london_ny_overlap"
  | "off_hours"
  | "unknown"

export type VyronisGrade = "A+" | "A" | "B" | "Skip"

export type VyronisRecommendation = "execute" | "reduce_size" | "wait" | "skip"

export type VyronisExecutionQuality = "excellent" | "good" | "marginal" | "poor" | "blocked"

/** Weekly / Daily / H4 alignment snapshot */
export type VyronisHtfBias = {
  weekly: VyronisBiasDirection
  daily: VyronisBiasDirection
  h4: VyronisBiasDirection
  /** Trade direction must align with dominant HTF bias when directional */
  tradeDirection: VyronisDirection
}

export type VyronisAoiInput = {
  /** Price reached the planned area of interest */
  reached: boolean
  /** AOI zone quality 0–100 (confluence, clarity, freshness) */
  qualityScore?: number | null
  /** Invalidation level is defined and respected */
  invalidationClear?: boolean
  /** Optional zone bounds for future screenshot / price checks */
  high?: number | null
  low?: number | null
}

export type VyronisLiquidityInput = {
  /** Sweep of prior high/low or equal highs/lows before entry */
  sweepDetected: boolean
  /** Sweep aligns with trade direction (e.g. sell-side liquidity taken before long) */
  alignedWithDirection?: boolean
  /** When unverified, journal left the field blank — do not penalize as absent */
  verificationStatus?: "verified" | "unverified" | "absent"
}

export type VyronisStructureInput = {
  shift: VyronisStructureShift
  /** CHoCH or BOS aligns with planned direction */
  alignedWithDirection?: boolean
}

export type VyronisConfirmationInput = {
  engulfing: VyronisEngulfingType
  /** Engulfing direction matches trade */
  alignedWithDirection?: boolean
  /** Additional confirmation signals (pin bar, break-retest, etc.) */
  additionalSignals?: string[]
}

export type VyronisSessionInput = {
  session: VyronisSession
  /** Session is appropriate for the pair / plan (e.g. GBP during London) */
  favorable?: boolean
}

export type VyronisRiskInput = {
  riskReward: number | null
  riskPercent?: number | null
  maxRiskPercent?: number | null
  /** Minimum RR per doctrine (default 2.0 in engine) */
  minimumRr?: number
}

export type VyronisNewsInput = {
  /** Major news within danger window (e.g. 30–60 min) */
  majorNewsProximity: boolean
  minutesToEvent?: number | null
  eventLabel?: string | null
}

export type VyronisEmotionInput = {
  state: VyronisEmotionState | string
  /** Optional pre-trade emotion check score 0–100 */
  checkScore?: number | null
}

/** Full trade evaluation payload — extend as integrations land */
export type VyronisTradeInput = {
  pair?: string
  htf: VyronisHtfBias
  aoi: VyronisAoiInput
  liquidity: VyronisLiquidityInput
  structure: VyronisStructureInput
  confirmation: VyronisConfirmationInput
  session: VyronisSessionInput
  risk: VyronisRiskInput
  news: VyronisNewsInput
  emotion: VyronisEmotionInput
  /** Optional metadata for downstream agents */
  metadata?: {
    source?: "manual" | "tradingview" | "mt5" | "screenshot" | "coach"
    signalId?: string
    tradeId?: string
    playbookId?: string
  }
}

export type VyronisScoreBreakdown = {
  htfAlignment: number
  aoiQuality: number
  structureShift: number
  confirmationCandle: number
  sessionTiming: number
  rrQuality: number
  emotionalDiscipline: number
}

export type VyronisScoreWeights = {
  htfAlignment: number
  aoiQuality: number
  structureShift: number
  confirmationCandle: number
  sessionTiming: number
  rrQuality: number
  emotionalDiscipline: number
}

/** Standardized Vyronis AI evaluation object returned by Vyronis Core Model */
export type VyronisEvaluation = {
  score: number
  grade: VyronisGrade
  reasons: string[]
  warnings: string[]
  executionQuality: VyronisExecutionQuality
  emotionalState: VyronisEmotionState
  recommendation: VyronisRecommendation
  breakdown: VyronisScoreBreakdown
  /** Hard doctrine blocks (HTF missing, unstable emotion) */
  hardSkip: boolean
  hardSkipReasons: string[]
  /** Doctrine version for persistence / agent context */
  doctrineVersion: string
}

export type VyronisComponentResult = {
  points: number
  maxPoints: number
  reasons: string[]
  warnings: string[]
  passed: boolean
}
