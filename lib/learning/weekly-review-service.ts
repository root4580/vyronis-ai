import { buildWeeklyDebrief, filterTradesForWeek, getWeekRange } from "@/lib/ai/weekly-debrief-engine"
import type { WeeklyDebriefResult } from "@/lib/ai/weekly-debrief-types"
import { generateFinalSummaryWithVyronisRouter } from "@/lib/ai/vyronis-ai-integration"
import { generateDebriefNarrativeWithProvider } from "@/lib/ai/providers"
import { generatePatternMemory } from "@/lib/trade-coach/pattern-memory"
import { buildEmotionalTrends } from "@/lib/learning/pattern-detection"
import { buildLearningDashboard, buildWeeklyReviewAdvice } from "@/lib/learning/learning-dashboard"
import type {
  WeeklyDebriefFeedback,
  WeeklyDebriefTrade,
} from "@/lib/ai/weekly-debrief-types"
import type {
  AiReviewRecord,
  LearningFeedbackRow,
  LearningTradeRow,
} from "@/lib/learning/types"
import type { PatternMemoryFeedback } from "@/lib/trade-coach/pattern-memory"

export function buildPersistedWeeklyReview(input: {
  trades: LearningTradeRow[]
  feedback: LearningFeedbackRow[]
  weekOffset?: number
  previousDisciplineAvg?: number | null
  maxRiskPerTrade?: number
}): AiReviewRecord {
  const weekRange = getWeekRange(new Date(), input.weekOffset ?? 0)
  const weekTrades = filterTradesForWeek(
    input.trades as unknown as WeeklyDebriefTrade[],
    weekRange.start,
    weekRange.end,
  )

  const debriefTrades = input.trades as unknown as WeeklyDebriefTrade[]
  const debriefFeedback = input.feedback.map((row) => ({
    trade_id: row.trade_id,
    discipline_score: row.discipline_score,
    planned_vs_actual: (row.planned_vs_actual ||
      []) as unknown as WeeklyDebriefFeedback["planned_vs_actual"],
  }))

  const patternResult = generatePatternMemory({
    trades: debriefTrades,
    feedback: debriefFeedback as PatternMemoryFeedback[],
    sessions: [],
    maxRiskPerTrade: input.maxRiskPerTrade ?? 1,
  })

  const debrief: WeeklyDebriefResult = buildWeeklyDebrief({
    trades: debriefTrades,
    feedback: debriefFeedback,
    coachSessions: [],
    patterns: patternResult.patterns,
    maxRiskPerTrade: input.maxRiskPerTrade ?? 1,
    weekStart: weekRange.start,
    weekEnd: weekRange.end,
    previousWeekDisciplineAvg: input.previousDisciplineAvg ?? null,
  })

  const dashboard = buildLearningDashboard({
    trades: weekTrades,
    feedback: input.feedback,
    maxRiskPerTrade: input.maxRiskPerTrade,
  })

  const emotionalTrends = buildEmotionalTrends(weekTrades).map((item) => ({
    emotion: item.emotion,
    count: item.count,
    trend: item.trend,
  }))

  const summary = `${weekTrades.length} trades · ${debrief.summary.winRate}% win rate · ${
    debrief.summary.totalPnL >= 0 ? "+" : ""
  }${debrief.summary.totalPnL.toFixed(2)} P&L`

  return {
    review_type: "weekly",
    week_start: weekRange.weekStartKey,
    week_end: weekRange.weekEndKey,
    summary,
    recurring_mistakes: debrief.summary.mostRepeatedMistake
      ? [debrief.summary.mostRepeatedMistake]
      : [],
    emotional_trends: emotionalTrends,
    discipline_score: debrief.summary.averageDisciplineScore ?? dashboard.disciplineScore,
    most_profitable_setup: debrief.summary.bestSetup,
    advice: buildWeeklyReviewAdvice({ trades: weekTrades, dashboard }),
    payload: debrief,
  }
}

export async function enrichWeeklyReviewWithProvider(
  review: AiReviewRecord,
  weekTrades: LearningTradeRow[],
): Promise<AiReviewRecord> {
  const debrief = review.payload as WeeklyDebriefResult
  const debriefInput = {
    summary: review.summary,
    tradeCount: weekTrades.length,
    winRate: debrief.summary?.winRate ?? 0,
    recurringMistakes: review.recurring_mistakes,
  }

  const router = await generateFinalSummaryWithVyronisRouter(debriefInput)
  if (router.narrative) {
    return { ...review, summary: router.narrative }
  }

  const aiNarrative = await generateDebriefNarrativeWithProvider(debriefInput)
  if (!aiNarrative) return review
  return { ...review, summary: aiNarrative }
}
