import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { SessionPerformance } from "@/lib/analytics-engine"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"
import type { PlannedCoachSessionItem, PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"
import type { WeeklyReviewReport } from "@/lib/weekly-review/types"
import type { AutonomousIntelligenceSnapshot } from "@/lib/autonomous/types"
import type { CognitiveIntelligenceSnapshot } from "@/lib/cognitive/types"
import type { TradingOsSnapshot } from "@/lib/trading-os/types"
import type { AdaptiveCognitionSnapshot } from "@/lib/adaptive-cognition/types"
import type { VyronisCoreSnapshot } from "@/lib/vyronis-core/types"
import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"
import type { OutcomeLessonRecord } from "@/lib/learning/outcome-learning-engine"
import type { EmotionalIntelligenceSnapshot } from "@/lib/intelligence/emotional-intelligence-engine"
import type { ToneMemorySnapshot } from "@/lib/intelligence/tone-memory-engine"
import type { TraderStateTimelineSnapshot } from "@/lib/intelligence/trader-state-timeline-engine"
import type { VerdictCalibrationSnapshot } from "@/lib/intelligence/verdict-calibration-engine"
import type { VisionIntelligenceSnapshot } from "@/lib/vyronis-core/phase7-engine"
import type { TraderContextMemory } from "@/lib/intelligence/trader-context"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"
import type { DailyRuleItem, RiskSnapshot, UserSettingsForm } from "@/lib/user-settings"

export type MemoryInsightCategory =
  | "repeated_behavior"
  | "improving_discipline"
  | "dangerous_pattern"
  | "best_setup_condition"
  | "emotional_trigger"

export type CommandCenterMemoryInsight = {
  id: string
  category: MemoryInsightCategory
  insight: string
  created_at: string
  metadata?: Record<string, unknown>
}

export type EmotionalStateSnapshot = {
  dominantEmotion: string | null
  impulsiveCount: number
  recentEmotions: string[]
  trend: "stable" | "elevated" | "volatile"
  note: string
}

export type MistakeHeatmapEntry = {
  label: string
  count: number
  lossRate: number
}

export type FullTraderContext = {
  traderName: string | null
  preferredSession: string
  settings: UserSettingsForm
  risk: RiskSnapshot
  dailyRules: DailyRuleItem[]
  memory: TraderContextMemory
  recentTrades: RecentTradeMemory[]
  mistakeHeatmap: MistakeHeatmapEntry[]
  emotionalState: EmotionalStateSnapshot
  sessionPerformance: SessionPerformance[]
  weeklyReview: WeeklyReviewReport | null
  playbooks: StrategyPlaybookRecord[]
  compressedMemories: CommandCenterMemoryInsight[]
  recentMessages: CommandCenterMessageRecord[]
  activePlannedContext: PreTradePlannedContext | null
  autonomous?: AutonomousIntelligenceSnapshot | null
  cognitive?: CognitiveIntelligenceSnapshot | null
  tradingOs?: TradingOsSnapshot | null
  adaptiveCognition?: AdaptiveCognitionSnapshot | null
  vyronisCore?: VyronisCoreSnapshot | null
  outcomeLessons?: OutcomeLessonRecord[]
  emotionalIntelligence?: EmotionalIntelligenceSnapshot | null
  traderStateTimeline?: TraderStateTimelineSnapshot | null
  verdictCalibration?: VerdictCalibrationSnapshot | null
  toneMemory?: ToneMemorySnapshot | null
  visionIntelligence?: VisionIntelligenceSnapshot | null
}

export type SimilarityDimension = {
  key: string
  label: string
  score: number
  match: boolean
  detail: string
}

export type SetupSimilarityMatch = {
  tradeId: string
  pair: string
  result: string
  pnl: number
  session: string | null
  similarityScore: number
  dimensions: SimilarityDimension[]
  summary: string
}

export type SetupSimilarityResult = {
  overallScore: number
  matchCount: number
  topMatches: SetupSimilarityMatch[]
  narrative: string
}

export type TradeDecisionRecommendation = "TAKE" | "CAUTION" | "SKIP"

export type TradeDecisionResult = {
  recommendation: TradeDecisionRecommendation
  confidence: number
  evidence: string[]
  nextQuestion: string
  similarity?: SetupSimilarityResult
  weightedConfidence?: import("@/lib/intelligence/weighted-confidence-engine").WeightedConfidenceResult
  psychWarning?: string | null
}

export type CompanionChatEngineResult = {
  content: string
  followUpQuestion?: string
  companionState: import("@/lib/intelligence/conversational-types").CompanionConversationalState
  thinkingPhases: string[]
  memoryReference?: string
  mentionedWarningIds: string[]
  isCriticalHighlight?: boolean
  intent: CompanionIntent
  engine: "llm" | "heuristic" | "vision"
  decision?: TradeDecisionResult
  primaryLeak: PrimaryLeakInsight
  topPatterns: PatternMemoryPattern[]
  chartVision?: import("@/lib/intelligence/command-center-vision-engine").CommandCenterVisionAnalysis
}
