import type { AdaptiveCognitionSnapshot } from "@/lib/adaptive-cognition/types"
import type { AutonomousIntelligenceSnapshot } from "@/lib/autonomous/types"
import type { CognitiveIntelligenceSnapshot } from "@/lib/cognitive/types"
import type { TradingOsSnapshot } from "@/lib/trading-os/types"
import type { TradeDecisionRecommendation } from "@/lib/intelligence/intelligence-types"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { VisionIntelligenceSnapshot } from "@/lib/vyronis-core/phase7-engine"

export type VyronisPhaseId = 5 | 6 | 7 | 8 | 9 | 10

export type CapabilityStatus = "active" | "partial" | "planned"

export type PhaseCapability = {
  id: string
  label: string
  status: CapabilityStatus
  module: string
  goalFeeling: string
}

export type VyronisPhaseDefinition = {
  phase: VyronisPhaseId
  title: string
  goal: string
  goalFeeling: string
  capabilities: PhaseCapability[]
  completionPercent: number
}

export type PreTradeApproval = {
  status: "approved" | "reduced" | "blocked" | "reflection_required"
  verdict: TradeDecisionRecommendation
  riskMultiplier: number
  headline: string
  reasons: string[]
  psychologyOverride: boolean
  shadowPause: boolean
}

export type ConfidenceDecaySnapshot = {
  currentConfidence: number
  decayRate: number
  factors: string[]
  sessionFatigue: boolean
  narrative: string
}

export type SetupProbabilitySnapshot = {
  score: number
  historicalWinRate: number | null
  patternMatch: string | null
  environmentFit: number
  narrative: string
}

export type AdaptiveRiskRestriction = {
  active: boolean
  maxRiskPercent: number
  maxTradesRemaining: number
  restrictions: string[]
}

export type LiveTraderStateSnapshot = {
  state: string
  emotionalDanger: "low" | "moderate" | "high" | "critical"
  fatigueLevel: number
  interventionActive: boolean
  narrative: string
}

export type RuleViolationForecast = {
  probability: number
  likelyViolations: string[]
  narrative: string
}

export type Phase5AutonomousLayer = {
  shadow: AutonomousIntelligenceSnapshot["shadow"]
  preTradeApproval: PreTradeApproval
  confidenceDecay: ConfidenceDecaySnapshot
  setupProbability: SetupProbabilitySnapshot
  adaptiveRisk: AdaptiveRiskRestriction
  liveTraderState: LiveTraderStateSnapshot
  ruleViolationForecast: RuleViolationForecast
  interventionPrompt: string | null
}

export type UnifiedMemoryCategory =
  | "trade"
  | "emotional"
  | "market"
  | "setup"
  | "behavioral"
  | "coaching"

export type UnifiedMemoryStatus = {
  categories: UnifiedMemoryCategory[]
  activeEngines: string[]
  narrative: string
}

export type VyronisDesignPhilosophy = {
  tagline: string
  pillars: string[]
}

export type VyronisCoreSnapshot = {
  computedAt: string
  philosophy: VyronisDesignPhilosophy
  phases: VyronisPhaseDefinition[]
  overallMaturity: number
  currentPhaseFocus: VyronisPhaseId
  phase5: Phase5AutonomousLayer
  phase7: VisionIntelligenceSnapshot | null
  memory: UnifiedMemoryStatus
  layers: {
    autonomous: AutonomousIntelligenceSnapshot | null
    cognitive: CognitiveIntelligenceSnapshot | null
    tradingOs: TradingOsSnapshot | null
    adaptiveCognition: AdaptiveCognitionSnapshot | null
  }
  headline: string
}

export type VyronisCoreInput = {
  context: FullTraderContext
  chartVision?: import("@/lib/intelligence/command-center-vision-engine").CommandCenterVisionAnalysis | null
}
