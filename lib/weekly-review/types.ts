import type { WeeklyDebriefResult } from "@/lib/ai/weekly-debrief-types"

export type WeeklyReviewProvider = "deterministic" | "openai" | "claude" | "gemini" | "heuristic"

export type WeeklyReviewScores = {
  discipline: number
  emotionalStability: number
  execution: number
  consistency: number
  overall: number
}

export type WeeklyReviewBehavioralFlags = {
  fomo: { detected: boolean; count: number; message: string | null }
  revenge: { detected: boolean; count: number; message: string | null }
  counterTrend: { detected: boolean; count: number; message: string | null }
}

export type WeeklyReviewInsight = {
  id: string
  category:
    | "mistake"
    | "emotion"
    | "discipline"
    | "setup"
    | "session"
    | "execution"
    | "behavior"
    | "positive"
  tone: "positive" | "warning" | "neutral"
  title: string
  message: string
}

export type WeeklyReviewDisciplineTrend = {
  direction: "up" | "down" | "flat"
  delta: number
  averageDiscipline: number | null
}

export type WeeklyReviewReport = {
  version: 1
  weekLabel: string
  weekStart: string
  weekEnd: string
  hasData: boolean
  tradeCount: number
  winRate: number
  totalPnL: number
  headline: string
  scores: WeeklyReviewScores
  recurringMistakes: string[]
  emotionalPatterns: Array<{ emotion: string; count: number; percentage: number }>
  disciplineTrend: WeeklyReviewDisciplineTrend
  bestSetupTypes: string[]
  behavioralFlags: WeeklyReviewBehavioralFlags
  strongestSession: string | null
  weakestHabit: string | null
  improvementPlan: string[]
  insights: WeeklyReviewInsight[]
  debrief: WeeklyDebriefResult
  provider: WeeklyReviewProvider
  generatedAt: string
}

export type WeeklyReviewRecord = {
  id: string
  user_id: string
  week_start: string
  week_end: string
  week_label: string
  summary: string
  discipline_score: number
  emotional_stability_score: number
  execution_score: number
  consistency_score: number
  overall_score: number
  recurring_mistakes: string[]
  emotional_patterns: WeeklyReviewReport["emotionalPatterns"]
  discipline_trends: WeeklyReviewDisciplineTrend
  best_setup_types: string[]
  behavioral_flags: WeeklyReviewBehavioralFlags
  strongest_session: string | null
  weakest_habit: string | null
  improvement_plan: string[]
  insights: WeeklyReviewInsight[]
  report_payload: WeeklyReviewReport
  provider: WeeklyReviewProvider
  created_at: string
  updated_at: string
}

export type BuildWeeklyReviewInput = {
  trades: import("@/lib/ai/weekly-debrief-types").WeeklyDebriefTrade[]
  feedback: import("@/lib/ai/weekly-debrief-types").WeeklyDebriefFeedback[]
  coachSessions: import("@/lib/ai/weekly-debrief-types").WeeklyDebriefCoachSession[]
  maxRiskPerTrade: number
  weekOffset?: number
  previousWeekDisciplineAvg?: number | null
}
