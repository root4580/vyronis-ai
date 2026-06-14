import {
  buildWeeklyDebrief,
  filterTradesForWeek,
  getWeekRange,
} from "@/lib/ai/weekly-debrief-engine"
import { buildMistakeAnalysis } from "@/lib/mistake-analysis"
import { generatePatternMemory } from "@/lib/trade-coach/pattern-memory"
import { getSignedPnL } from "@/lib/trade-utils"
import { generateFinalSummaryWithVyronisRouter } from "@/lib/ai/vyronis-ai-integration"
import { generateDebriefNarrativeWithProvider, getConfiguredAiProviderId } from "@/lib/ai/providers"
import {
  buildVyronisReviewScores,
  calculateConsistencyScore,
  countBehavioralTrades,
} from "@/lib/weekly-review/scoring"
import type {
  BuildWeeklyReviewInput,
  WeeklyReviewBehavioralFlags,
  WeeklyReviewInsight,
  WeeklyReviewReport,
} from "@/lib/weekly-review/types"

function buildEmotionalPatterns(
  weekTrades: BuildWeeklyReviewInput["trades"],
): WeeklyReviewReport["emotionalPatterns"] {
  const counts = new Map<string, number>()
  for (const trade of weekTrades) {
    const emotion = trade.emotion?.trim() || "Unknown"
    counts.set(emotion, (counts.get(emotion) ?? 0) + 1)
  }
  const total = weekTrades.length || 1
  return Array.from(counts.entries())
    .map(([emotion, count]) => ({
      emotion,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

function buildBehavioralFlags(
  weekTrades: BuildWeeklyReviewInput["trades"],
  dangerousPatterns: string[],
): WeeklyReviewBehavioralFlags {
  const { fomoTrades, revengeTrades } = countBehavioralTrades(weekTrades)
  const counterTrendMsg = dangerousPatterns.find((item) =>
    item.toLowerCase().includes("counter"),
  )

  return {
    fomo: {
      detected: fomoTrades.length > 0,
      count: fomoTrades.length,
      message:
        fomoTrades.length > 0
          ? `${fomoTrades.length} FOMO-tagged trade${fomoTrades.length > 1 ? "s" : ""} this week.`
          : null,
    },
    revenge: {
      detected: revengeTrades.length > 0,
      count: revengeTrades.length,
      message:
        revengeTrades.length > 0
          ? `${revengeTrades.length} revenge emotional entr${revengeTrades.length > 1 ? "ies" : "y"} logged.`
          : null,
    },
    counterTrend: {
      detected: Boolean(counterTrendMsg),
      count: counterTrendMsg ? 1 : 0,
      message: counterTrendMsg ?? null,
    },
  }
}

function buildInsights(
  report: Omit<WeeklyReviewReport, "insights" | "headline" | "generatedAt" | "provider" | "debrief">,
  debrief: WeeklyReviewReport["debrief"],
): WeeklyReviewInsight[] {
  const insights: WeeklyReviewInsight[] = []
  let index = 0

  const push = (
    category: WeeklyReviewInsight["category"],
    tone: WeeklyReviewInsight["tone"],
    title: string,
    message: string,
  ) => {
    insights.push({ id: `insight-${index++}`, category, tone, title, message })
  }

  for (const mistake of report.recurringMistakes.slice(0, 2)) {
    push("mistake", "warning", "Recurring mistake", mistake)
  }

  for (const pattern of report.emotionalPatterns.slice(0, 2)) {
    push(
      "emotion",
      ["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"].includes(pattern.emotion)
        ? "warning"
        : "neutral",
      `${pattern.emotion} frequency`,
      `${pattern.emotion} appeared on ${pattern.count} trade${pattern.count > 1 ? "s" : ""} (${pattern.percentage}%).`,
    )
  }

  if (report.disciplineTrend.direction === "up") {
    push(
      "discipline",
      "positive",
      "Discipline improving",
      `Discipline trend is up ${report.disciplineTrend.delta > 0 ? `(+${report.disciplineTrend.delta} pts)` : ""} vs last week.`,
    )
  } else if (report.disciplineTrend.direction === "down") {
    push(
      "discipline",
      "warning",
      "Discipline slipping",
      `Discipline declined ${Math.abs(report.disciplineTrend.delta)} pts versus last week.`,
    )
  }

  for (const setup of report.bestSetupTypes.slice(0, 2)) {
    push("setup", "positive", "Best setup", `${setup} delivered your strongest process this week.`)
  }

  if (report.strongestSession) {
    push(
      "session",
      "positive",
      "Strongest session",
      `${report.strongestSession} was your highest-performing session window.`,
    )
  }

  if (report.weakestHabit) {
    push("execution", "warning", "Weakest habit", report.weakestHabit)
  }

  if (report.behavioralFlags.fomo.detected && report.behavioralFlags.fomo.message) {
    push("behavior", "warning", "FOMO behavior", report.behavioralFlags.fomo.message)
  }
  if (report.behavioralFlags.revenge.detected && report.behavioralFlags.revenge.message) {
    push("behavior", "warning", "Revenge behavior", report.behavioralFlags.revenge.message)
  }

  for (const item of debrief.commentary.strongestHabits.slice(0, 2)) {
    push("positive", "positive", "Strength", item)
  }

  return insights.slice(0, 12)
}

function buildHeadline(
  weekTrades: BuildWeeklyReviewInput["trades"],
  winRate: number,
  totalPnL: number,
  scores: WeeklyReviewReport["scores"],
): string {
  if (weekTrades.length === 0) {
    return "No trades logged this week — journal entries unlock your AI weekly review."
  }

  const pnlLabel = `${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}`
  return `${weekTrades.length} trades · ${winRate}% win rate · ${pnlLabel} P&L · Overall ${scores.overall}/100`
}

export function buildWeeklyReviewReport(input: BuildWeeklyReviewInput): WeeklyReviewReport {
  const weekRange = getWeekRange(new Date(), input.weekOffset ?? 0)
  const weekTrades = filterTradesForWeek(input.trades, weekRange.start, weekRange.end)

  const patternResult = generatePatternMemory({
    trades: input.trades,
    feedback: input.feedback.map((row) => ({
      trade_id: row.trade_id,
      discipline_score: row.discipline_score,
      planned_vs_actual: row.planned_vs_actual,
    })),
    sessions: [],
    maxRiskPerTrade: input.maxRiskPerTrade,
  })

  const debrief = buildWeeklyDebrief({
    trades: input.trades,
    feedback: input.feedback,
    coachSessions: input.coachSessions,
    patterns: patternResult.patterns,
    maxRiskPerTrade: input.maxRiskPerTrade,
    weekStart: weekRange.start,
    weekEnd: weekRange.end,
    previousWeekDisciplineAvg: input.previousWeekDisciplineAvg ?? null,
  })

  debrief.weekLabel = weekRange.label

  const mistakeAnalysis = buildMistakeAnalysis(weekTrades)
  const recurringMistakes = [
    ...(debrief.summary.mostRepeatedMistake ? [debrief.summary.mostRepeatedMistake] : []),
    ...mistakeAnalysis.leaderboard.slice(0, 3).map((entry) => entry.label),
  ].filter((label, idx, arr) => arr.indexOf(label) === idx)

  const consistencyScore = calculateConsistencyScore(weekTrades)
  const scores = buildVyronisReviewScores({
    disciplineScore: debrief.grades.disciplineScore,
    emotionalStabilityScore: debrief.grades.psychologyScore,
    executionScore: debrief.grades.executionScore,
    consistencyScore,
  })

  const bestSetupTypes = [
    debrief.summary.bestSetup,
    debrief.summary.worstSetup && debrief.summary.worstSetup !== debrief.summary.bestSetup
      ? `Avoid: ${debrief.summary.worstSetup}`
      : null,
  ].filter((value): value is string => Boolean(value))

  const behavioralFlags = buildBehavioralFlags(weekTrades, debrief.commentary.dangerousPatterns)

  const weakestHabit =
    debrief.commentary.executionProblems[0] ??
    debrief.summary.mostRepeatedMistake ??
    (debrief.commentary.dangerousPatterns[0] || null)

  const wins = weekTrades.filter((trade) => trade.result === "WIN").length
  const totalPnL = weekTrades.reduce((sum, trade) => sum + getSignedPnL(trade.pnl, trade.result), 0)

  const partial: Omit<
    WeeklyReviewReport,
    "insights" | "headline" | "generatedAt" | "provider" | "debrief"
  > = {
    version: 1,
    weekLabel: weekRange.label,
    weekStart: weekRange.weekStartKey,
    weekEnd: weekRange.weekEndKey,
    hasData: weekTrades.length > 0,
    tradeCount: weekTrades.length,
    winRate: weekTrades.length > 0 ? Math.round((wins / weekTrades.length) * 100) : 0,
    totalPnL,
    scores,
    recurringMistakes,
    emotionalPatterns: buildEmotionalPatterns(weekTrades),
    disciplineTrend: {
      direction: debrief.summary.disciplineTrend,
      delta: debrief.summary.disciplineTrendDelta,
      averageDiscipline: debrief.summary.averageDisciplineScore,
    },
    bestSetupTypes,
    behavioralFlags,
    strongestSession: debrief.summary.bestSession,
    weakestHabit,
    improvementPlan: debrief.recommendations,
  }

  const insights = buildInsights(partial, debrief)
  const headline = buildHeadline(weekTrades, partial.winRate, totalPnL, scores)

  return {
    ...partial,
    headline,
    insights,
    debrief,
    provider: "deterministic",
    generatedAt: new Date().toISOString(),
  }
}

export async function enrichWeeklyReviewWithAi(
  report: WeeklyReviewReport,
): Promise<WeeklyReviewReport> {
  const debriefInput = {
    summary: report.headline,
    tradeCount: report.tradeCount,
    winRate: report.winRate,
    recurringMistakes: report.recurringMistakes,
  }

  const router = await generateFinalSummaryWithVyronisRouter(debriefInput)
  if (router.narrative) {
    const routerProvider =
      router.provider === "openai" ||
      router.provider === "claude" ||
      router.provider === "gemini"
        ? router.provider
        : getConfiguredAiProviderId() ?? "openai"
    return {
      ...report,
      headline: router.narrative,
      provider: routerProvider,
    }
  }

  const narrative = await generateDebriefNarrativeWithProvider(debriefInput)

  if (!narrative) return report

  const providerId = getConfiguredAiProviderId()

  return {
    ...report,
    headline: narrative,
    provider: providerId ?? "openai",
  }
}

export function weeklyReviewReportToRow(
  userId: string,
  report: WeeklyReviewReport,
): Omit<import("@/lib/weekly-review/types").WeeklyReviewRecord, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    week_start: report.weekStart,
    week_end: report.weekEnd,
    week_label: report.weekLabel,
    summary: report.headline,
    discipline_score: report.scores.discipline,
    emotional_stability_score: report.scores.emotionalStability,
    execution_score: report.scores.execution,
    consistency_score: report.scores.consistency,
    overall_score: report.scores.overall,
    recurring_mistakes: report.recurringMistakes,
    emotional_patterns: report.emotionalPatterns,
    discipline_trends: report.disciplineTrend,
    best_setup_types: report.bestSetupTypes,
    behavioral_flags: report.behavioralFlags,
    strongest_session: report.strongestSession,
    weakest_habit: report.weakestHabit,
    improvement_plan: report.improvementPlan,
    insights: report.insights,
    report_payload: report,
    provider: report.provider,
  }
}

export function weeklyReviewRowToReport(row: import("@/lib/weekly-review/types").WeeklyReviewRecord): WeeklyReviewReport {
  const payload = row.report_payload
  if (payload && payload.version === 1) {
    return payload
  }

  return {
    version: 1,
    weekLabel: row.week_label,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    hasData: true,
    tradeCount: 0,
    winRate: 0,
    totalPnL: 0,
    headline: row.summary,
    scores: {
      discipline: row.discipline_score,
      emotionalStability: row.emotional_stability_score,
      execution: row.execution_score,
      consistency: row.consistency_score,
      overall: row.overall_score,
    },
    recurringMistakes: row.recurring_mistakes,
    emotionalPatterns: row.emotional_patterns,
    disciplineTrend: row.discipline_trends,
    bestSetupTypes: row.best_setup_types,
    behavioralFlags: row.behavioral_flags,
    strongestSession: row.strongest_session,
    weakestHabit: row.weakest_habit,
    improvementPlan: row.improvement_plan,
    insights: row.insights,
    debrief: payload?.debrief ?? ({} as WeeklyReviewReport["debrief"]),
    provider: row.provider,
    generatedAt: row.updated_at,
  }
}
