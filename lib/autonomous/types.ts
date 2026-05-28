import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

/** Intelligence layer identifiers — long-term: voice, mobile, MT5, TV live, streaming coach */
export type IntelligenceLayerId =
  | "vision"
  | "reasoning"
  | "memory"
  | "psychology"
  | "scoring"
  | "orchestration"

export type ShadowRiskLevel = "low" | "moderate" | "elevated" | "critical"

export type ShadowAssessment = {
  emotionalRiskScore: number
  disciplineConfidence: number
  executionQualityPrediction: number
  overtradingProbability: number
  revengeTradingSignal: number
  impulsiveEntryLikelihood: number
  disciplineDrift: number
  overallRiskLevel: ShadowRiskLevel
  flags: string[]
  proactiveMessage: string
  shouldPause: boolean
}

export type TraderDnaProfile = {
  version: number
  bestSetupTypes: string[]
  strongestSessions: string[]
  emotionalTriggers: string[]
  highestWinrateConditions: string
  recurringMistakes: string[]
  averageRr: number | null
  averageHoldMinutes: number | null
  idealMarketConditions: string
  archetype: string
  weeklyInsight: string | null
  confidenceScore: number
  computedAt: string
}

export type SessionMarketContext =
  | "london_continuation"
  | "ny_reversal"
  | "asia_compression"
  | "news_volatility"
  | "low_liquidity"
  | "neutral"

export type SessionIntelligence = {
  phase: string
  marketContext: SessionMarketContext
  narrative: string
  tradingBias: string
  liquidityNote: string
  volatilityNote: string
  confidence: number
}

export type PatternFingerprintCluster = {
  clusterKey: string
  clusterType: "win" | "loss" | "emotional_breakdown" | "a_plus_execution"
  label: string
  occurrenceCount: number
  avgRr: number | null
  matchScoreBaseline: number
  fingerprint: Record<string, unknown>
}

export type PatternMatchResult = {
  bestMatch: PatternFingerprintCluster | null
  similarityScore: number
  narrative: string | null
}

export type TradeReflection = {
  planVsExecution: string
  emotionBeforeAfter: string
  disciplineGaps: string[]
  lesson: string
  category: "discipline" | "emotion" | "execution" | "risk" | "setup" | "session"
  score: number
}

export type ProactiveNudge = {
  id: string
  priority: "low" | "medium" | "high"
  message: string
  source: "shadow" | "session" | "dna" | "pattern" | "reflection"
}

export type AutonomousIntelligenceSnapshot = {
  computedAt: string
  shadow: ShadowAssessment
  traderDna: TraderDnaProfile
  session: SessionIntelligence
  patternClusters: PatternFingerprintCluster[]
  patternMatch: PatternMatchResult
  recentLessons: string[]
  proactiveNudges: ProactiveNudge[]
  capabilities: {
    voice: "planned"
    mobile: "planned"
    tradingViewLive: "planned"
    mt5: "partial"
    streamingReplies: "active"
    realtimeCoaching: "partial"
    aiReplay: "active"
  }
}

export type AutonomousEngineInput = {
  context: FullTraderContext
  plannedContext?: PreTradePlannedContext | null
  trigger?: "context_load" | "pre_trade" | "chart_upload" | "trade_complete"
}
