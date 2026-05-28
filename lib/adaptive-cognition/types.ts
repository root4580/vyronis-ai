import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"

/** Optional daily life context — correlates with trading performance */
export type LifeContextEntry = {
  date: string
  sleepQuality?: number | null
  stress?: number | null
  workFatigue?: number | null
  gymConsistency?: number | null
  emotionalState?: number | null
  focusLevel?: number | null
  notes?: string | null
}

export type IdentityDimension = {
  key: string
  label: string
  score: number
  trend: "rising" | "stable" | "falling"
  narrative: string
}

export type TraderIdentitySnapshot = {
  archetype: string
  becoming: string
  dimensions: IdentityDimension[]
  overallMaturity: number
}

export type LifeContextCorrelation = {
  factor: string
  correlation: "positive" | "negative" | "neutral"
  insight: string
  confidence: number
}

export type LifeContextSnapshot = {
  latest: LifeContextEntry | null
  recentEntries: LifeContextEntry[]
  correlations: LifeContextCorrelation[]
  narrative: string
}

export type BehavioralCycleId =
  | "burnout"
  | "confidence_inflation"
  | "revenge_spiral"
  | "discipline_streak"
  | "emotional_recovery"

export type BehavioralCycleSignal = {
  cycle: BehavioralCycleId
  active: boolean
  severity: number
  narrative: string
  predictedInstabilityDays: number | null
}

export type BehavioralModelSnapshot = {
  cycles: BehavioralCycleSignal[]
  instabilityRisk: number
  recoverySpeed: number
  narrative: string
}

export type PerformanceAttribution = {
  luck: number
  skill: number
  discipline: number
  execution: number
  marketConditions: number
  narrative: string
  luckyWinWarning: string | null
}

export type PersonalOsMode = "focus" | "recovery" | "reflection" | "planning" | "neutral"

export type PersonalOsFlow = {
  id: string
  label: string
  description: string
  status: "active" | "available" | "planned"
}

export type PersonalOperatingSystem = {
  recommendedMode: PersonalOsMode
  activeFlows: PersonalOsFlow[]
  dailyReflectionPrompt: string
  planningPrompt: string
  selfReviewCadence: "daily" | "weekly"
}

export type StrategicDecisionArea =
  | "scaling"
  | "account_management"
  | "risk_expansion"
  | "capital_preservation"
  | "consistency_milestones"

export type StrategicGuidance = {
  area: StrategicDecisionArea
  headline: string
  guidance: string
  priority: "high" | "medium" | "low"
}

export type StrategicThinkingSnapshot = {
  items: StrategicGuidance[]
  capitalPreservationScore: number
  consistencyMilestone: string | null
}

export type CompanionEvolutionSnapshot = {
  communicationStyle: string
  challengeLevel: "gentle" | "direct" | "socratic"
  personalizationNotes: string[]
  memoryTone: string
  irrationalThinkingChecks: string[]
}

export type AutonomousInsight = {
  id: string
  pattern: string
  message: string
  confidence: number
  category: "discipline" | "emotion" | "execution" | "life" | "market" | "identity"
}

export type IntelligenceEcosystemCapability = {
  id: string
  surface: "mobile" | "desktop" | "voice" | "wearable" | "replay" | "live_market" | "portfolio"
  status: "planned" | "partial" | "active"
  description: string
}

export type IntelligenceEcosystem = {
  philosophy: string
  capabilities: IntelligenceEcosystemCapability[]
  crossAccountReady: boolean
}

export type AdaptiveCognitionSnapshot = {
  computedAt: string
  identity: TraderIdentitySnapshot
  lifeContext: LifeContextSnapshot
  behavioral: BehavioralModelSnapshot
  performance: PerformanceAttribution
  personalOs: PersonalOperatingSystem
  strategic: StrategicThinkingSnapshot
  companion: CompanionEvolutionSnapshot
  insights: AutonomousInsight[]
  ecosystem: IntelligenceEcosystem
  headline: string
}

export type AdaptiveCognitionInput = {
  context: FullTraderContext
  lifeContextHistory?: LifeContextEntry[]
}
