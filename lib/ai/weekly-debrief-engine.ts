import { buildMistakeAnalysis } from "@/lib/mistake-analysis"
import { buildStrategyPerformance } from "@/lib/strategy-performance"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"
import type { TradeQualityGrade } from "@/lib/trade-coach/trade-quality-engine"
import { getSignedPnL } from "@/lib/trade-utils"
import type {
  BuildWeeklyDebriefInput,
  WeekRange,
  WeeklyDebriefCommentary,
  WeeklyDebriefGrades,
  WeeklyDebriefJournalLinks,
  WeeklyDebriefResult,
  WeeklyDebriefSummary,
  WeeklyDebriefTrade,
  WeeklyDebriefVisualizations,
  WeeklyJournalTradeLink,
  WeeklyTrendPoint,
} from "@/lib/ai/weekly-debrief-types"

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])
const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function gradeFromScore(score: number): TradeQualityGrade {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

export function getWeekRange(referenceDate = new Date(), weekOffset = 0): WeekRange {
  const date = new Date(referenceDate)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + weekOffset * 7)

  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(date)
  start.setDate(date.getDate() + mondayOffset)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  const label = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`

  return { start, end, label }
}

export function getTradeTimestamp(trade: WeeklyDebriefTrade): number {
  return new Date(trade.trade_date || trade.created_at).getTime()
}

export function filterTradesForWeek(
  trades: WeeklyDebriefTrade[],
  weekStart: Date,
  weekEnd: Date,
): WeeklyDebriefTrade[] {
  const startMs = weekStart.getTime()
  const endMs = weekEnd.getTime()
  return trades.filter((trade) => {
    const ts = getTradeTimestamp(trade)
    return ts >= startMs && ts <= endMs
  })
}

function groupPnLByField(
  trades: WeeklyDebriefTrade[],
  field: "setup" | "session",
): { best: string | null; worst: string | null } {
  const grouped = new Map<string, number>()
  for (const trade of trades) {
    const key = (field === "setup" ? trade.setup : trade.session)?.trim() || "Unassigned"
    grouped.set(key, (grouped.get(key) || 0) + getSignedPnL(trade.pnl, trade.result))
  }
  if (grouped.size === 0) return { best: null, worst: null }
  const entries = [...grouped.entries()].filter(([name]) => name !== "Unassigned" || grouped.size === 1)
  if (entries.length === 0) return { best: null, worst: null }
  entries.sort((a, b) => b[1] - a[1])
  return { best: entries[0][0], worst: entries[entries.length - 1][0] }
}

function worstEmotionalState(trades: WeeklyDebriefTrade[]): string | null {
  const grouped = new Map<string, { losses: number; count: number }>()
  for (const trade of trades) {
    const emotion = trade.emotion_after || trade.emotion
    if (!emotion) continue
    const bucket = grouped.get(emotion) || { losses: 0, count: 0 }
    bucket.count += 1
    if (trade.result === "LOSS") bucket.losses += 1
    grouped.set(emotion, bucket)
  }

  let worst: { emotion: string; rate: number } | null = null
  for (const [emotion, stats] of grouped.entries()) {
    const rate = stats.count > 0 ? stats.losses / stats.count : 0
    if (!worst || rate > worst.rate || (rate === worst.rate && IMPULSIVE_EMOTIONS.has(emotion))) {
      worst = { emotion, rate }
    }
  }
  return worst?.emotion ?? null
}

function buildSummary(
  weekTrades: WeeklyDebriefTrade[],
  feedback: BuildWeeklyDebriefInput["feedback"],
  coachSessions: BuildWeeklyDebriefInput["coachSessions"],
  previousWeekDisciplineAvg: number | null | undefined,
): WeeklyDebriefSummary {
  const wins = weekTrades.filter((trade) => trade.result === "WIN").length
  const totalPnL = weekTrades.reduce((sum, trade) => sum + getSignedPnL(trade.pnl, trade.result), 0)
  const setupGroups = groupPnLByField(weekTrades, "setup")
  const sessionGroups = groupPnLByField(weekTrades, "session")

  const weekFeedback = feedback.filter((row) =>
    weekTrades.some((trade) => trade.id === String(row.trade_id)),
  )
  const averageDisciplineScore =
    weekFeedback.length > 0
      ? Math.round(
          weekFeedback.reduce((sum, row) => sum + row.discipline_score, 0) / weekFeedback.length,
        )
      : null

  const weekSessions = coachSessions.filter((session) =>
    weekTrades.some((trade) => trade.id === String(session.trade_id)),
  )
  const qualityScores = weekSessions
    .map((session) => session.quality_score)
    .filter((score): score is number => score !== null)
  const averageQualityScore =
    qualityScores.length > 0
      ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
      : null

  const mistakeAnalysis = buildMistakeAnalysis(weekTrades)
  let disciplineTrend: WeeklyDebriefSummary["disciplineTrend"] = "flat"
  let disciplineTrendDelta = 0
  if (averageDisciplineScore !== null && previousWeekDisciplineAvg != null) {
    disciplineTrendDelta = averageDisciplineScore - previousWeekDisciplineAvg
    if (disciplineTrendDelta >= 4) disciplineTrend = "up"
    else if (disciplineTrendDelta <= -4) disciplineTrend = "down"
  }

  return {
    tradeCount: weekTrades.length,
    totalPnL,
    winRate: weekTrades.length > 0 ? Math.round((wins / weekTrades.length) * 100) : 0,
    bestSetup: setupGroups.best,
    worstSetup: setupGroups.worst,
    bestSession: sessionGroups.best,
    worstSession: sessionGroups.worst,
    worstEmotionalState: worstEmotionalState(weekTrades),
    disciplineTrend,
    disciplineTrendDelta,
    averageQualityScore,
    averageDisciplineScore,
    mostRepeatedMistake: mistakeAnalysis.topRepeated?.label ?? null,
  }
}

function buildCommentary(
  weekTrades: WeeklyDebriefTrade[],
  summary: WeeklyDebriefSummary,
  feedback: BuildWeeklyDebriefInput["feedback"],
  patterns: PatternMemoryPattern[],
  maxRiskPerTrade: number,
): WeeklyDebriefCommentary {
  const improved: string[] = []
  const declined: string[] = []
  const emotionalObservations: string[] = []
  const executionProblems: string[] = []
  const strongestHabits: string[] = []
  const dangerousPatterns: string[] = []

  if (summary.disciplineTrend === "up") {
    improved.push(
      `Discipline improved ${summary.disciplineTrendDelta > 0 ? `(+${summary.disciplineTrendDelta} pts)` : ""} versus last week.`,
    )
  } else if (summary.disciplineTrend === "down") {
    declined.push(`Discipline declined ${summary.disciplineTrendDelta} pts versus last week.`)
  }

  if (summary.bestSetup) {
    improved.push(`${summary.bestSetup} setups performed best this week.`)
  }
  if (summary.worstSetup && summary.worstSetup !== summary.bestSetup) {
    declined.push(`${summary.worstSetup} setups underperformed — review before repeating.`)
  }
  if (summary.bestSession) {
    improved.push(`${summary.bestSession} session delivered your strongest results.`)
  }

  const fomoTrades = weekTrades.filter(
    (trade) => trade.emotion === "FOMO" || trade.emotion_after === "FOMO",
  )
  if (fomoTrades.length > 0) {
    emotionalObservations.push("FOMO still appears in this week's execution log.")
    if (fomoTrades.some((trade) => trade.result === "LOSS")) {
      dangerousPatterns.push("FOMO entries linked to losing outcomes.")
    }
  }

  const revengeTrades = weekTrades.filter((trade) => trade.emotion === "Revenge")
  if (revengeTrades.length > 0) {
    emotionalObservations.push("Revenge-style emotional entries were logged.")
    dangerousPatterns.push("Revenge trading pattern detected.")
  }

  const stableRate =
    weekTrades.length > 0
      ? weekTrades.filter((trade) => STABLE_EMOTIONS.has(trade.emotion)).length / weekTrades.length
      : 0
  if (stableRate >= 0.6) {
    strongestHabits.push("Stable pre-trade emotional states were common this week.")
  }

  const rulesFollowed = weekTrades.filter((trade) => trade.rule_followed === true).length
  if (weekTrades.length > 0 && rulesFollowed / weekTrades.length >= 0.75) {
    strongestHabits.push("Rule adherence stayed strong across most trades.")
  }

  const weekFeedback = feedback.filter((row) =>
    weekTrades.some((trade) => trade.id === String(row.trade_id)),
  )
  for (const row of weekFeedback) {
    for (const comparison of row.planned_vs_actual) {
      if (!comparison.aligned) {
        executionProblems.push(`${comparison.field}: ${comparison.note}`)
      }
    }
  }

  const overRiskTrades = weekTrades.filter(
    (trade) => (trade.risk_percent ?? 0) > maxRiskPerTrade,
  )
  if (overRiskTrades.length > 0) {
    executionProblems.push(`${overRiskTrades.length} trade(s) exceeded your ${maxRiskPerTrade}% risk cap.`)
  }

  if (summary.worstEmotionalState && IMPULSIVE_EMOTIONS.has(summary.worstEmotionalState)) {
    emotionalObservations.push(
      `${summary.worstEmotionalState} was your most costly emotional state this week.`,
    )
  }

  for (const pattern of patterns.slice(0, 4)) {
    if (pattern.severity === "warning") dangerousPatterns.push(pattern.message)
    if (pattern.severity === "positive") strongestHabits.push(pattern.message)
  }

  const strategyPerf = buildStrategyPerformance(weekTrades)
  if (strategyPerf.bestStrategy) {
    improved.push(
      `${strategyPerf.bestStrategy.name} was your top strategy (${strategyPerf.bestStrategy.winRate}% WR).`,
    )
  }

  return {
    improved: [...new Set(improved)].slice(0, 5),
    declined: [...new Set(declined)].slice(0, 4),
    emotionalObservations: [...new Set(emotionalObservations)].slice(0, 4),
    executionProblems: [...new Set(executionProblems)].slice(0, 5),
    strongestHabits: [...new Set(strongestHabits)].slice(0, 4),
    dangerousPatterns: [...new Set(dangerousPatterns)].slice(0, 4),
  }
}

function buildGrades(
  weekTrades: WeeklyDebriefTrade[],
  feedback: BuildWeeklyDebriefInput["feedback"],
  summary: WeeklyDebriefSummary,
  maxRiskPerTrade: number,
): WeeklyDebriefGrades {
  const weekFeedback = feedback.filter((row) =>
    weekTrades.some((trade) => trade.id === String(row.trade_id)),
  )

  const disciplineScore = clamp(
    summary.averageDisciplineScore ??
      (weekTrades.filter((trade) => trade.rule_followed !== false).length /
        Math.max(weekTrades.length, 1)) *
        100,
  )

  let aligned = 0
  let totalComparisons = 0
  for (const row of weekFeedback) {
    for (const comparison of row.planned_vs_actual) {
      totalComparisons += 1
      if (comparison.aligned) aligned += 1
    }
  }
  const executionScore = clamp(
    totalComparisons > 0 ? Math.round((aligned / totalComparisons) * 100) : disciplineScore,
  )

  const psychStable = weekTrades.filter((trade) => STABLE_EMOTIONS.has(trade.emotion)).length
  const psychImpulsive = weekTrades.filter((trade) => IMPULSIVE_EMOTIONS.has(trade.emotion)).length
  const psychologyScore = clamp(
    weekTrades.length > 0
      ? Math.round((psychStable / weekTrades.length) * 100 - (psychImpulsive / weekTrades.length) * 25)
      : 55,
  )

  const riskAligned = weekTrades.filter(
    (trade) => (trade.risk_percent ?? maxRiskPerTrade) <= maxRiskPerTrade,
  ).length
  const riskManagementScore = clamp(
    weekTrades.length > 0 ? Math.round((riskAligned / weekTrades.length) * 100) : 70,
  )

  const overallScore = clamp(
    Math.round(
      disciplineScore * 0.3 +
        executionScore * 0.25 +
        psychologyScore * 0.25 +
        riskManagementScore * 0.2,
    ),
  )

  return {
    discipline: gradeFromScore(disciplineScore),
    execution: gradeFromScore(executionScore),
    psychology: gradeFromScore(psychologyScore),
    riskManagement: gradeFromScore(riskManagementScore),
    overall: gradeFromScore(overallScore),
    disciplineScore,
    executionScore,
    psychologyScore,
    riskManagementScore,
    overallScore,
  }
}

function buildRecommendations(
  summary: WeeklyDebriefSummary,
  commentary: WeeklyDebriefCommentary,
  grades: WeeklyDebriefGrades,
): string[] {
  const recommendations: string[] = []

  if (commentary.dangerousPatterns.some((item) => item.toLowerCase().includes("fomo"))) {
    recommendations.push("Pause after consecutive wins — FOMO is showing up in your weekly log.")
  }
  if (grades.executionScore < 55) {
    recommendations.push("Wait for M15 confirmation before entry — execution drift was elevated this week.")
  }
  if (summary.worstSetup) {
    recommendations.push(`Reduce or refine ${summary.worstSetup} setups until process quality improves.`)
  }
  if (commentary.executionProblems.some((item) => item.toLowerCase().includes("countertrend"))) {
    recommendations.push("Reduce countertrend trades next week.")
  }
  if (summary.bestSession && summary.bestSession !== "Unassigned") {
    recommendations.push(`Your best trades came from ${summary.bestSession} — prioritize that session window.`)
  }
  if (grades.riskManagementScore < 70) {
    recommendations.push("Cap risk at your playbook maximum — oversizing appeared this week.")
  }
  if (recommendations.length === 0) {
    recommendations.push("Keep running pre-trade coach check-ins before every A+ setup.")
    recommendations.push("Review execution replay on your worst trade to reinforce lessons.")
  }

  return [...new Set(recommendations)].slice(0, 5)
}

function dayIndexForTrade(trade: WeeklyDebriefTrade, weekStart: Date): number {
  const ts = getTradeTimestamp(trade)
  const day = new Date(ts)
  day.setHours(12, 0, 0, 0)
  const start = new Date(weekStart)
  start.setHours(0, 0, 0, 0)
  return clamp(Math.floor((day.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)), 0, 6)
}

function buildVisualizations(
  weekTrades: WeeklyDebriefTrade[],
  feedback: BuildWeeklyDebriefInput["feedback"],
  coachSessions: BuildWeeklyDebriefInput["coachSessions"],
  weekStart: Date,
): WeeklyDebriefVisualizations {
  const disciplineGraph: WeeklyTrendPoint[] = WEEKDAY_LABELS.map((label) => ({ label, value: 0 }))
  const emotionalStabilityGraph: WeeklyTrendPoint[] = WEEKDAY_LABELS.map((label) => ({
    label,
    value: 0,
  }))
  const qualityScoreTrend: WeeklyTrendPoint[] = WEEKDAY_LABELS.map((label) => ({ label, value: 0 }))
  const disciplineCounts = Array(7).fill(0)
  const emotionCounts = Array(7).fill(0)
  const qualityCounts = Array(7).fill(0)

  for (const trade of weekTrades) {
    const index = dayIndexForTrade(trade, weekStart)
    const row = feedback.find((item) => String(item.trade_id) === trade.id)
    if (row) {
      disciplineGraph[index].value += row.discipline_score
      disciplineCounts[index] += 1
    }
    emotionCounts[index] += 1
    emotionalStabilityGraph[index].value += STABLE_EMOTIONS.has(trade.emotion) ? 100 : 45

    const session = coachSessions.find((item) => String(item.trade_id) === trade.id)
    if (session?.quality_score != null) {
      qualityScoreTrend[index].value += session.quality_score
      qualityCounts[index] += 1
    }
  }

  for (let i = 0; i < 7; i += 1) {
    if (disciplineCounts[i] > 0) disciplineGraph[i].value = Math.round(disciplineGraph[i].value / disciplineCounts[i])
    if (emotionCounts[i] > 0) {
      emotionalStabilityGraph[i].value = Math.round(emotionalStabilityGraph[i].value / emotionCounts[i])
    }
    if (qualityCounts[i] > 0) qualityScoreTrend[i].value = Math.round(qualityScoreTrend[i].value / qualityCounts[i])
  }

  const streakTimeline = [...weekTrades]
    .sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
    .map((trade) => ({
      label: trade.pair,
      result: trade.result,
      date: trade.trade_date || trade.created_at,
      tradeId: trade.id,
    }))

  const mistakeAnalysis = buildMistakeAnalysis(weekTrades)
  const mistakeFrequency = mistakeAnalysis.leaderboard.slice(0, 6).map((entry) => ({
    label: entry.label,
    count: entry.count,
  }))

  return {
    disciplineGraph,
    emotionalStabilityGraph,
    qualityScoreTrend,
    streakTimeline,
    mistakeFrequency,
  }
}

function toJournalLink(trade: WeeklyDebriefTrade): WeeklyJournalTradeLink {
  return {
    id: trade.id,
    pair: trade.pair,
    result: trade.result,
    pnl: getSignedPnL(trade.pnl, trade.result),
    screenshot_url: trade.screenshot_url,
  }
}

function buildJournalLinks(
  weekTrades: WeeklyDebriefTrade[],
  feedback: BuildWeeklyDebriefInput["feedback"],
): WeeklyDebriefJournalLinks {
  if (weekTrades.length === 0) {
    return {
      bestTrade: null,
      worstTrade: null,
      replayTradeIds: [],
      screenshotTradeIds: [],
    }
  }

  const sorted = [...weekTrades].sort(
    (a, b) => getSignedPnL(b.pnl, b.result) - getSignedPnL(a.pnl, a.result),
  )

  return {
    bestTrade: toJournalLink(sorted[0]),
    worstTrade: toJournalLink(sorted[sorted.length - 1]),
    replayTradeIds: feedback
      .filter((row) => weekTrades.some((trade) => trade.id === String(row.trade_id)))
      .map((row) => String(row.trade_id)),
    screenshotTradeIds: weekTrades.filter((trade) => trade.screenshot_url).map((trade) => trade.id),
  }
}

export function buildWeeklyDebrief(input: BuildWeeklyDebriefInput): WeeklyDebriefResult {
  const weekTrades = filterTradesForWeek(input.trades, input.weekStart, input.weekEnd)
  const weekPatterns = input.patterns.filter((pattern) =>
    pattern.message.length > 0,
  )

  const summary = buildSummary(
    weekTrades,
    input.feedback,
    input.coachSessions,
    input.previousWeekDisciplineAvg,
  )
  const commentary = buildCommentary(
    weekTrades,
    summary,
    input.feedback,
    weekPatterns,
    input.maxRiskPerTrade,
  )
  const grades = buildGrades(weekTrades, input.feedback, summary, input.maxRiskPerTrade)
  const recommendations = buildRecommendations(summary, commentary, grades)
  const visualizations = buildVisualizations(
    weekTrades,
    input.feedback,
    input.coachSessions,
    input.weekStart,
  )
  const journalLinks = buildJournalLinks(weekTrades, input.feedback)

  return {
    version: 1,
    weekLabel: `${input.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${input.weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
    weekStart: input.weekStart.toISOString(),
    weekEnd: input.weekEnd.toISOString(),
    hasData: weekTrades.length > 0,
    summary,
    commentary,
    grades,
    recommendations,
    visualizations,
    journalLinks,
    patternHighlights: weekPatterns.slice(0, 6),
  }
}
