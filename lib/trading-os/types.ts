import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"

export type LiveAlertSeverity = "info" | "warning" | "critical"

export type LiveSessionAlert = {
  id: string
  severity: LiveAlertSeverity
  category:
    | "session_transition"
    | "volatility_shift"
    | "overtrading"
    | "emotional_drift"
    | "drawdown"
    | "discipline"
  message: string
  actionHint: string | null
  createdAt: string
}

export type LiveSessionMonitoring = {
  activeSession: string
  sessionIsActive: boolean
  previousSession: string | null
  sessionTransitionPending: boolean
  volatilityState: "compressed" | "normal" | "expanded" | "unknown"
  overtradingLevel: "low" | "moderate" | "high" | "critical"
  emotionalDriftScore: number
  emotionalDriftNarrative: string
  alerts: LiveSessionAlert[]
  monitoringActive: boolean
}

export type InterventionAction =
  | "reduce_size"
  | "stand_down"
  | "block_impulsive_confirmation"
  | "require_reflection"

export type AutonomousIntervention = {
  id: string
  active: boolean
  severity: LiveAlertSeverity
  actions: InterventionAction[]
  headline: string
  message: string
  canProceedToEntry: boolean
  reflectionPrompt: string | null
  suggestedRiskMultiplier: number
  expiresAfterMinutes: number | null
}

export type EvolutionTrend = "improving" | "stable" | "declining"

export type EvolutionMetric = {
  label: string
  current: number
  prior: number
  trend: EvolutionTrend
  narrative: string
}

export type TraderEvolutionSnapshot = {
  disciplineTrend: EvolutionMetric
  emotionalStability: EvolutionMetric
  executionConsistency: EvolutionMetric
  setupQuality: EvolutionMetric
  bestEnvironment: { label: string; winRate: number; tradeCount: number } | null
  weeklyReport: string
  monthlyReport: string
  overallEvolutionScore: number
}

export type ReplayScenarioId =
  | "respect_sl"
  | "wait_confirmation"
  | "reduce_size"
  | "no_revenge_entry"
  | "follow_plan"

export type ReplayScenarioResult = {
  scenarioId: ReplayScenarioId
  question: string
  narrative: string
  processImpact: string
  estimatedOutcomeShift: "better" | "same" | "worse" | "unknown"
  confidence: number
}

export type AiReplaySimulation = {
  tradeId: string | null
  reconstruction: {
    marketContext: string
    emotionalState: string
    executionTiming: string
    planDeviation: string
  }
  scenarios: ReplayScenarioResult[]
  primaryLesson: string
}

export type StrategyIntelligenceSnapshot = {
  topSetupModel: string | null
  weakestConditions: string[]
  emotionalIncompatibilities: string[]
  sessionEdge: { session: string; edge: string; winRate: number }[]
  adaptiveGuidance: string[]
}

export type LiveTradeCompanionSnapshot = {
  active: boolean
  tradeLabel: string | null
  executionQuality: number
  emotionalEscalation: number
  panicManagementRisk: number
  ruleDeviationFlags: string[]
  liveNarrative: string
  coachingLine: string
}

export type TimelineEventType =
  | "trade"
  | "emotion"
  | "mistake"
  | "breakthrough"
  | "psychology_milestone"
  | "confidence_shift"
  | "intervention"
  | "lesson"

export type IntelligenceTimelineEvent = {
  id: string
  type: TimelineEventType
  title: string
  summary: string
  severity: LiveAlertSeverity | null
  occurredAt: string
  metadata?: Record<string, unknown>
}

export type IntelligenceTimeline = {
  events: IntelligenceTimelineEvent[]
  narrative: string
}

export type VoiceCompanionCapability = {
  id: string
  label: string
  status: "planned" | "partial" | "active"
  description: string
}

export type VoiceCompanionFoundation = {
  capabilities: VoiceCompanionCapability[]
  sessionContractVersion: number
  supportedIntents: string[]
  realtimeReady: boolean
}

export type TradingOsCapabilities = {
  liveMonitoring: "active"
  interventions: "active"
  evolutionDashboard: "active"
  replaySimulator: "active"
  strategyIntelligence: "active"
  liveTradeCompanion: "partial"
  voiceCompanion: "planned"
  intelligenceTimeline: "active"
}

export type TradingOsSnapshot = {
  computedAt: string
  liveSession: LiveSessionMonitoring
  intervention: AutonomousIntervention
  evolution: TraderEvolutionSnapshot
  replay: AiReplaySimulation | null
  strategy: StrategyIntelligenceSnapshot
  liveCompanion: LiveTradeCompanionSnapshot
  timeline: IntelligenceTimeline
  voice: VoiceCompanionFoundation
  capabilities: TradingOsCapabilities
  proactiveHeadline: string
}

export type TradingOsEngineInput = {
  context: FullTraderContext
  lastKnownSession?: string | null
  focusTradeId?: string | null
}
