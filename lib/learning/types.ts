import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"
import type { WeeklyDebriefResult } from "@/lib/ai/weekly-debrief-types"

export type LearningTradeRow = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  setup: string
  strategy_name?: string | null
  session?: string | null
  risk_percent?: number | null
  rule_followed?: boolean | null
  mistake_tags?: string | null
  confirmation_signal?: string | null
  trade_date?: string | null
  created_at: string
  screenshot_url?: string | null
  reflection_chart_url?: string | null
  entry_timeframe?: string | null
  higher_timeframe?: string | null
  confirmation_timeframe?: string | null
  risk_reward?: number | null
  trade_notes?: string | null
}

export type LearningFeedbackRow = {
  trade_id: string
  session_id?: string | null
  discipline_score: number
  coaching_summary?: string
  feedback_points?: string[]
  planned_vs_actual?: Array<{ field: string; planned: string; actual: string; match: boolean }>
}

export type TradeMemoryRecord = {
  id?: string
  user_id: string
  trade_id: string
  session_id?: string | null
  pair: string
  direction: string
  timeframe: string | null
  setup_type: string | null
  result: string
  rr_achieved: number | null
  emotion_before: string | null
  emotion_after: string | null
  mistakes: string[]
  screenshot_url: string | null
  ai_verdict: string | null
  ai_summary: string
  coaching_feedback: Record<string, unknown>
  htf_alignment_score: number | null
  session: string | null
  strategy_name: string | null
  metadata?: Record<string, unknown>
}

export type EmotionalPatternRecord = {
  pattern_key: string
  label: string
  category: string
  severity: "warning" | "insight" | "positive"
  occurrence_count: number
  loss_count: number
  win_count: number
  trend: "increasing" | "stable" | "decreasing"
  last_seen_at: string | null
  metadata?: Record<string, unknown>
}

export type SetupStatisticsRecord = {
  setup_type: string
  trade_count: number
  win_count: number
  loss_count: number
  breakeven_count: number
  win_rate: number
  total_pnl: number
  avg_rr: number | null
  best_session: string | null
  best_emotion: string | null
  htf_alignment_accuracy: number
}

export type DetectedBehaviorPattern = {
  key: string
  label: string
  category: "mistake" | "emotion" | "discipline" | "execution"
  severity: "warning" | "insight" | "positive"
  count: number
  message: string
}

export type WinningPatternInsight = {
  key: string
  label: string
  value: string
  winRate?: number
  tradeCount?: number
  message: string
}

export type JournalIntelligenceResult = {
  summary: string
  detectedMistakes: string[]
  coachingFeedback: string[]
  comparisons: string[]
  verdict: "strong" | "mixed" | "weak"
  reinforcedPatterns: DetectedBehaviorPattern[]
  winningSignals: WinningPatternInsight[]
}

export type LearningDashboardData = {
  disciplineScore: number
  emotionalStability: number
  bestSetupType: WinningPatternInsight | null
  mistakeHeatmap: Array<{ label: string; count: number; lossRate: number }>
  winRateByPair: Array<{ pair: string; winRate: number; trades: number; pnl: number }>
  htfAlignmentAccuracy: number
  recurringPatterns: DetectedBehaviorPattern[]
  winningPatterns: WinningPatternInsight[]
  tradeMemoryCount: number
}

export type AiReviewRecord = {
  id?: string
  review_type: "weekly" | "trade" | "monthly"
  week_start: string | null
  week_end: string | null
  summary: string
  recurring_mistakes: string[]
  emotional_trends: Array<{ emotion: string; count: number; trend: string }>
  discipline_score: number
  most_profitable_setup: string | null
  advice: string[]
  payload: WeeklyDebriefResult | Record<string, unknown>
}

export type LearningMemorySnapshot = {
  dashboard: LearningDashboardData
  patterns: PatternMemoryPattern[]
  emotionalPatterns: EmotionalPatternRecord[]
  setupStatistics: SetupStatisticsRecord[]
  recentMemories: TradeMemoryRecord[]
}
