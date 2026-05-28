import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { SessionPerformance } from "@/lib/analytics-engine"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"
import type { PlannedCoachSessionItem, PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"
import type { WeeklyReviewReport } from "@/lib/weekly-review/types"
import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"
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
  engine: "llm" | "heuristic"
  decision?: TradeDecisionResult
  primaryLeak: PrimaryLeakInsight
  topPatterns: PatternMemoryPattern[]
}
