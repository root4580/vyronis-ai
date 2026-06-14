import type { TradeQualityGrade } from "@/lib/trade-coach/trade-quality-engine"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"

export type WeeklyDebriefTrade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  setup: string
  strategy_name: string | null
  session: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  mistake_tags?: string | null
  confirmation_signal?: string | null
  trade_date: string | null
  created_at: string
  screenshot_url?: string | null
}

export type WeeklyDebriefFeedback = {
  trade_id: string
  discipline_score: number
  planned_vs_actual: Array<{
    field: string
    planned: string
    actual: string
    aligned: boolean
    note: string
  }>
}

export type WeeklyDebriefCoachSession = {
  id: string
  trade_id: string | null
  quality_score: number | null
  quality_grade: TradeQualityGrade | null
  recommendation: string | null
  confidence_score: number | null
  updated_at: string
}

export type WeeklyDebriefSummary = {
  tradeCount: number
  totalPnL: number
  winRate: number
  bestSetup: string | null
  worstSetup: string | null
  bestSession: string | null
  worstSession: string | null
  worstEmotionalState: string | null
  disciplineTrend: "up" | "down" | "flat"
  disciplineTrendDelta: number
  averageQualityScore: number | null
  averageDisciplineScore: number | null
  mostRepeatedMistake: string | null
}

export type WeeklyDebriefCommentary = {
  improved: string[]
  declined: string[]
  emotionalObservations: string[]
  executionProblems: string[]
  strongestHabits: string[]
  dangerousPatterns: string[]
}

export type WeeklyDebriefGrades = {
  discipline: TradeQualityGrade
  execution: TradeQualityGrade
  psychology: TradeQualityGrade
  riskManagement: TradeQualityGrade
  overall: TradeQualityGrade
  disciplineScore: number
  executionScore: number
  psychologyScore: number
  riskManagementScore: number
  overallScore: number
}

export type WeeklyTrendPoint = {
  label: string
  value: number
}

export type WeeklyStreakPoint = {
  label: string
  result: string
  date: string
  tradeId: string
}

export type WeeklyMistakePoint = {
  label: string
  count: number
}

export type WeeklyDebriefVisualizations = {
  disciplineGraph: WeeklyTrendPoint[]
  emotionalStabilityGraph: WeeklyTrendPoint[]
  qualityScoreTrend: WeeklyTrendPoint[]
  streakTimeline: WeeklyStreakPoint[]
  mistakeFrequency: WeeklyMistakePoint[]
}

export type WeeklyJournalTradeLink = {
  id: string
  pair: string
  result: string
  pnl: number
  screenshot_url?: string | null
}

export type WeeklyDebriefJournalLinks = {
  bestTrade: WeeklyJournalTradeLink | null
  worstTrade: WeeklyJournalTradeLink | null
  replayTradeIds: string[]
  screenshotTradeIds: string[]
}

export type WeeklyDebriefResult = {
  version: 1
  weekLabel: string
  weekStart: string
  weekEnd: string
  hasData: boolean
  summary: WeeklyDebriefSummary
  commentary: WeeklyDebriefCommentary
  grades: WeeklyDebriefGrades
  recommendations: string[]
  visualizations: WeeklyDebriefVisualizations
  journalLinks: WeeklyDebriefJournalLinks
  patternHighlights: PatternMemoryPattern[]
}

export type BuildWeeklyDebriefInput = {
  trades: WeeklyDebriefTrade[]
  feedback: WeeklyDebriefFeedback[]
  coachSessions: WeeklyDebriefCoachSession[]
  patterns: PatternMemoryPattern[]
  maxRiskPerTrade: number
  weekStart: Date
  weekEnd: Date
  previousWeekDisciplineAvg?: number | null
}

export type WeekRange = {
  start: Date
  end: Date
  weekStartKey: string
  weekEndKey: string
  label: string
}
