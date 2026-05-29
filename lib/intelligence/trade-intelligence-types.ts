import type { SetupScoreResult } from "@/lib/trade-coach/setup-score-engine"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"
import type {
  DetectedBehaviorPattern,
  JournalIntelligenceResult,
  LearningFeedbackRow,
  LearningTradeRow,
  WinningPatternInsight,
} from "@/lib/learning/types"
import type { SetupSimilarityResult } from "@/lib/intelligence/intelligence-types"
import type { TradeDetailInsight } from "@/lib/trade-detail-insights"

export type TradeTagGroup = {
  setup: string
  emotion: string
  emotionAfter: string | null
  mistakeTags: string[]
  suggestedTags: string[]
  strategyName: string | null
  session: string | null
}

export type EmotionTrackingSnapshot = {
  before: { label: string; emoji: string }
  after: { label: string; emoji: string } | null
  shiftedToCalm: boolean
  dominantRecentEmotion: string | null
  emotionalStabilityScore: number
  trends: Array<{ emotion: string; count: number; trend: string }>
  insight: string | null
}

export type ScreenshotIntelligence = {
  url: string | null
  attached: boolean
  visionAvailable: boolean
  message: string
}

export type WinLossPatternSplit = {
  winning: PatternMemoryPattern[]
  losing: PatternMemoryPattern[]
  behavioral: DetectedBehaviorPattern[]
  winningSignals: WinningPatternInsight[]
}

export type TradeIntelligenceBundle = {
  tradeId: string
  importSource?: string | null
  generatedAt: string
  tags: TradeTagGroup
  setupScore: SetupScoreResult
  disciplineScore: number
  disciplineSource: "coach" | "trade_heuristic" | "portfolio"
  emotion: EmotionTrackingSnapshot
  screenshot: ScreenshotIntelligence
  analysis: JournalIntelligenceResult
  tradeInsights: TradeDetailInsight[]
  historicalComparison: SetupSimilarityResult
  comparisonNarratives: string[]
  winLossPatterns: WinLossPatternSplit
  patternMemory: PatternMemoryPattern[]
  coachFeedback: LearningFeedbackRow | null
  syncedAt: string | null
}
