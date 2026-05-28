import type { TradeDecisionRecommendation } from "@/lib/intelligence/intelligence-types"
import type { TraderResponseMode } from "@/lib/intelligence/trader-response-mode"

/** Internal trader cognitive states — dynamic, not static labels */
export type CognitiveTraderState =
  | "calm"
  | "focused"
  | "impulsive"
  | "revenge_driven"
  | "fatigued"
  | "euphoric"
  | "disciplined"

export type AdaptiveCoachingMode =
  | "calm_analytical"
  | "strict_funded_guardian"
  | "emotional_reset"
  | "anti_revenge"
  | "confidence_restoration"

export type MarketEnvironmentLabel =
  | "trending"
  | "expanding_volatility"
  | "compression"
  | "choppy"
  | "reversal_conditions"
  | "continuation_conditions"
  | "liquidity_sweep"
  | "neutral"

export type MemoryLayerId =
  | "trade"
  | "emotional"
  | "setup"
  | "market"
  | "behavioral"

export type CognitiveStateSnapshot = {
  primary: CognitiveTraderState
  secondary: CognitiveTraderState | null
  confidence: number
  stability: number
  narrative: string
  drivers: string[]
  /** 0–100 — higher = stricter verdicts, tighter risk tone */
  verdictStrictness: number
  /** 0–100 — permission to size up / take marginal setups */
  riskPermission: number
  updatedAt: string
}

export type ConfidencePhase = "before_entry" | "during_trade" | "after_outcome"

export type ConfidenceNode = {
  phase: ConfidencePhase
  perceived: number
  inferredQuality: number
  gap: number
  label: string
}

export type DecisionConfidenceGraph = {
  nodes: ConfidenceNode[]
  fakeConfidence: boolean
  emotionalCertainty: boolean
  hesitationPattern: boolean
  narrative: string
}

export type AdaptiveCoachingSnapshot = {
  mode: AdaptiveCoachingMode
  responseMode: TraderResponseMode
  headline: string
  toneGuide: string
  coachingFocus: string
  maxParagraphs: number
}

export type MarketEnvironmentSnapshot = {
  primary: MarketEnvironmentLabel
  labels: MarketEnvironmentLabel[]
  narrative: string
  tradingBias: string
  usedInVerdict: boolean
  confidence: number
}

export type MemoryLayerInsight = {
  layer: MemoryLayerId
  insights: string[]
  strength: number
}

export type MultiLayerMemorySnapshot = {
  layers: MemoryLayerInsight[]
  crossMemorySynthesis: string
}

export type PredictionSnapshot = {
  overtradingProbability: number
  revengeProbability: number
  executionQualityForecast: number
  disciplineStability: number
  emotionalRiskTrajectory: "rising" | "stable" | "falling"
  narrative: string
}

export type TradeReplayIntelligence = {
  plannedLogic: string
  actualOutcome: string
  whatChanged: string
  emotionalDeviationMoments: string[]
  lesson: string
  reconstructionScore: number
}

export type CognitiveCapabilities = {
  voice: "planned"
  mobileCompanion: "planned"
  wearableNotifications: "planned"
  liveMarketMonitoring: "partial"
  mt5ExecutionAssistant: "partial"
  streamingMemoryTimeline: "planned"
  aiReplaySimulator: "active"
}

export type CognitiveIntelligenceSnapshot = {
  computedAt: string
  state: CognitiveStateSnapshot
  confidenceGraph: DecisionConfidenceGraph
  coaching: AdaptiveCoachingSnapshot
  marketEnvironment: MarketEnvironmentSnapshot
  memory: MultiLayerMemorySnapshot
  predictions: PredictionSnapshot
  replay: TradeReplayIntelligence | null
  capabilities: CognitiveCapabilities
}

export type CognitiveEngineInput = {
  context: import("@/lib/intelligence/intelligence-types").FullTraderContext
  chartVision?: import("@/lib/intelligence/command-center-vision-engine").CommandCenterVisionAnalysis | null
  recentMessageTone?: "calm" | "anxious" | "rushed" | "neutral"
}
