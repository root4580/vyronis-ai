import { parseMistakeTags } from "@/lib/trade-form-config"
import { normalizeMistakeLabel } from "@/lib/mistake-tags"
import {
  aggregateVisualMistakePatterns,
  topVisualMistakeMessage,
} from "@/lib/chart-annotations/annotation-engine"
import type {
  PlannedVsActualComparison,
  PreTradePlannedContext,
} from "@/lib/trade-coach/types"

export const MIN_TRADES_FOR_PATTERNS = 3

export type PatternMemoryCategory =
  | "mistake"
  | "emotion"
  | "session"
  | "strategy"
  | "discipline"
  | "risk"
  | "streak"
  | "plan_gap"
  | "countertrend"
  | "chart_vision"

export type PatternMemoryPattern = {
  id: string
  category: PatternMemoryCategory
  severity: "warning" | "insight" | "positive"
  message: string
  score: number
}

export type PatternMemoryTrade = {
  id: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  strategy_name?: string | null
  session?: string | null
  risk_percent?: number | null
  rule_followed?: boolean | null
  mistake_tags?: string | null
  confirmation_signal?: string | null
  trade_date?: string | null
  created_at: string
}

export type PatternMemoryFeedback = {
  trade_id: string
  discipline_score: number
  planned_vs_actual: PlannedVsActualComparison[]
}

export type PatternMemorySession = {
  trade_id: string | null
  planned_context: PreTradePlannedContext
  screenshot_url?: string | null
  vision_score?: number | null
  chart_analysis?: PreTradePlannedContext["chart_analysis"] | null
  chart_annotations?: PreTradePlannedContext["chart_annotations"] | null
}

export type PatternMemoryInput = {
  trades: PatternMemoryTrade[]
  feedback: PatternMemoryFeedback[]
  sessions: PatternMemorySession[]
  maxRiskPerTrade: number
}

export type PatternMemoryResult = {
  hasEnoughData: boolean
  tradeCount: number
  coachLinkedCount: number
  patterns: PatternMemoryPattern[]
  emptyMessage: string
}

const BEARISH_SIGNALS = new Set([
  "Head and Shoulders",
  "Double Top",
  "Triple Top",
  "Bearish Engulfing",
  "Evening Star",
  "Shooting Star",
  "Bear Flag",
  "Descending Triangle",
  "Resistance Rejection",
])

const BULLISH_SIGNALS = new Set([
  "Inverse Head and Shoulders",
  "Double Bottom",
  "Triple Bottom",
  "Bullish Engulfing",
  "Morning Star",
  "Hammer",
  "Bull Flag",
  "Ascending Triangle",
  "Support Rejection",
])

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])

function getTradeTimestamp(trade: PatternMemoryTrade): number {
  return new Date(trade.trade_date || trade.created_at).getTime()
}

function sortTradesChronologically(trades: PatternMemoryTrade[]): PatternMemoryTrade[] {
  return [...trades].sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
}

function isCounterTrend(trade: PatternMemoryTrade): boolean {
  const signal = trade.confirmation_signal
  if (!signal) return false

  const bearish =
    BEARISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bearish") ||
    signal.toLowerCase().includes("resistance")
  const bullish =
    BULLISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bullish") ||
    signal.toLowerCase().includes("support") ||
    signal.toLowerCase().includes("hammer")

  if (trade.direction === "BUY" && bearish && !bullish) return true
  if (trade.direction === "SELL" && bullish && !bearish) return true
  return false
}

function estimateDiscipline(trade: PatternMemoryTrade, maxRiskPerTrade: number): number {
  let score = 72
  if (trade.rule_followed === false) score -= 22
  if ((trade.risk_percent ?? 0) > maxRiskPerTrade) score -= 18
  if (IMPULSIVE_EMOTIONS.has(trade.emotion)) score -= 12
  if (trade.result === "WIN" && trade.rule_followed !== false) score += 8
  return Math.max(0, Math.min(100, score))
}

function getDisciplineScore(
  trade: PatternMemoryTrade,
  feedbackByTradeId: Map<string, PatternMemoryFeedback>,
  maxRiskPerTrade: number,
): number {
  const feedback = feedbackByTradeId.get(String(trade.id))
  return feedback?.discipline_score ?? estimateDiscipline(trade, maxRiskPerTrade)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function detectRepeatedMistakes(trades: PatternMemoryTrade[]): PatternMemoryPattern[] {
  const counts = new Map<string, number>()
  for (const trade of trades) {
    for (const tag of parseMistakeTags(trade.mistake_tags)) {
      const label = normalizeMistakeLabel(tag)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  }

  const patterns: PatternMemoryPattern[] = []
  for (const [label, count] of counts.entries()) {
    if (count < 2) continue
    const frequency = count / trades.length
    if (frequency < 0.25) continue

    patterns.push({
      id: `mistake-${label.toLowerCase().replace(/\s+/g, "-")}`,
      category: "mistake",
      severity: "warning",
      message: `You repeat ${label.toLowerCase()} behavior — it showed up on ${count} of your last ${trades.length} trades.`,
      score: 70 + frequency * 20 + count,
    })
  }

  return patterns
}

function detectFomoAfterLosses(trades: PatternMemoryTrade[]): PatternMemoryPattern | null {
  const ordered = sortTradesChronologically(trades)
  const fomoTrades = ordered.filter((trade) => trade.emotion === "FOMO")
  if (fomoTrades.length < 2) return null

  let afterLoss = 0
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].emotion !== "FOMO") continue
    if (ordered[index - 1].result === "LOSS") afterLoss += 1
  }

  const rate = afterLoss / fomoTrades.length
  if (afterLoss < 2 || rate < 0.5) return null

  return {
    id: "fomo-after-loss",
    category: "emotion",
    severity: "warning",
    message: "You repeat FOMO entries after losses.",
    score: 88 + rate * 10,
  }
}

function detectRevengeAfterLosses(trades: PatternMemoryTrade[]): PatternMemoryPattern | null {
  const ordered = sortTradesChronologically(trades)
  const revengeTrades = ordered.filter((trade) => trade.emotion === "Revenge")
  if (revengeTrades.length < 2) return null

  let afterLoss = 0
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].emotion !== "Revenge") continue
    if (ordered[index - 1].result === "LOSS") afterLoss += 1
  }

  if (afterLoss < 2) return null

  return {
    id: "revenge-after-loss",
    category: "emotion",
    severity: "warning",
    message: "Revenge entries often follow losses — pause before re-entering.",
    score: 86,
  }
}

function detectEuphoricDisciplineDrop(
  trades: PatternMemoryTrade[],
  feedbackByTradeId: Map<string, PatternMemoryFeedback>,
  maxRiskPerTrade: number,
): PatternMemoryPattern | null {
  const euphoricAfter = trades.filter((trade) => trade.emotion_after === "Euphoric")
  if (euphoricAfter.length < 2) return null

  const euphoricScores = euphoricAfter.map((trade) =>
    getDisciplineScore(trade, feedbackByTradeId, maxRiskPerTrade),
  )
  const baselineScores = trades
    .filter((trade) => trade.emotion_after !== "Euphoric")
    .map((trade) => getDisciplineScore(trade, feedbackByTradeId, maxRiskPerTrade))

  if (baselineScores.length === 0) return null

  const euphoricAvg = average(euphoricScores)
  const baselineAvg = average(baselineScores)
  if (euphoricAvg > baselineAvg - 8) return null

  return {
    id: "euphoric-discipline-drop",
    category: "discipline",
    severity: "warning",
    message: "Your discipline drops when emotion after = euphoric.",
    score: 90 + (baselineAvg - euphoricAvg),
  }
}

function detectSessionDiscipline(
  trades: PatternMemoryTrade[],
  feedbackByTradeId: Map<string, PatternMemoryFeedback>,
  maxRiskPerTrade: number,
): PatternMemoryPattern[] {
  const bySession = new Map<string, number[]>()

  for (const trade of trades) {
    const session = trade.session?.trim()
    if (!session) continue
    const scores = bySession.get(session) || []
    scores.push(getDisciplineScore(trade, feedbackByTradeId, maxRiskPerTrade))
    bySession.set(session, scores)
  }

  const ranked = [...bySession.entries()]
    .filter(([, scores]) => scores.length >= 2)
    .map(([session, scores]) => ({
      session,
      avg: average(scores),
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)

  if (ranked.length === 0) return []

  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  const patterns: PatternMemoryPattern[] = [
    {
      id: `session-best-${best.session.toLowerCase().replace(/\s+/g, "-")}`,
      category: "session",
      severity: "positive",
      message: `${best.session} session has your best discipline.`,
      score: 75 + best.avg / 4,
    },
  ]

  if (ranked.length > 1 && worst.avg <= best.avg - 10) {
    patterns.push({
      id: `session-weak-${worst.session.toLowerCase().replace(/\s+/g, "-")}`,
      category: "session",
      severity: "insight",
      message: `${worst.session} session shows weaker discipline than your best sessions.`,
      score: 68 + (best.avg - worst.avg),
    })
  }

  return patterns
}

function detectStrategyPerformance(trades: PatternMemoryTrade[]): PatternMemoryPattern[] {
  const byStrategy = new Map<string, { wins: number; total: number; losses: number }>()

  for (const trade of trades) {
    const strategy = trade.strategy_name?.trim()
    if (!strategy) continue
    const bucket = byStrategy.get(strategy) || { wins: 0, total: 0, losses: 0 }
    bucket.total += 1
    if (trade.result === "WIN") bucket.wins += 1
    if (trade.result === "LOSS") bucket.losses += 1
    byStrategy.set(strategy, bucket)
  }

  const ranked = [...byStrategy.entries()]
    .filter(([, stats]) => stats.total >= 2)
    .map(([strategy, stats]) => ({
      strategy,
      winRate: stats.wins / stats.total,
      stats,
    }))
    .sort((a, b) => a.winRate - b.winRate)

  if (ranked.length === 0) return []

  const weakest = ranked[0]
  const strongest = ranked[ranked.length - 1]
  const patterns: PatternMemoryPattern[] = []

  if (weakest.winRate < 0.45) {
    patterns.push({
      id: `strategy-weak-${weakest.strategy.toLowerCase().replace(/\s+/g, "-")}`,
      category: "strategy",
      severity: "insight",
      message: `${weakest.strategy} has your lowest win rate (${Math.round(weakest.winRate * 100)}%) over recent trades.`,
      score: 72,
    })
  }

  if (strongest !== weakest && strongest.winRate >= 0.55) {
    patterns.push({
      id: `strategy-strong-${strongest.strategy.toLowerCase().replace(/\s+/g, "-")}`,
      category: "strategy",
      severity: "positive",
      message: `${strongest.strategy} is performing best for you (${Math.round(strongest.winRate * 100)}% win rate).`,
      score: 70,
    })
  }

  return patterns
}

function detectCounterTrendQuality(
  trades: PatternMemoryTrade[],
  feedbackByTradeId: Map<string, PatternMemoryFeedback>,
  maxRiskPerTrade: number,
): PatternMemoryPattern | null {
  const counter = trades.filter(isCounterTrend)
  const aligned = trades.filter((trade) => !isCounterTrend(trade) && trade.confirmation_signal)
  if (counter.length < 2 || aligned.length < 2) return null

  const counterScore = average(
    counter.map((trade) => getDisciplineScore(trade, feedbackByTradeId, maxRiskPerTrade)),
  )
  const alignedScore = average(
    aligned.map((trade) => getDisciplineScore(trade, feedbackByTradeId, maxRiskPerTrade)),
  )

  if (counterScore > alignedScore - 8) return null

  return {
    id: "countertrend-lower-quality",
    category: "countertrend",
    severity: "warning",
    message: "Countertrend trades have lower quality scores.",
    score: 84 + (alignedScore - counterScore),
  }
}

function detectRuleBreaksAfterWinStreak(trades: PatternMemoryTrade[]): PatternMemoryPattern | null {
  const ordered = sortTradesChronologically(trades)
  let streak = 0
  let afterStreakTotal = 0
  let afterStreakBreaks = 0

  for (const trade of ordered) {
    if (streak >= 2) {
      afterStreakTotal += 1
      if (trade.rule_followed === false) afterStreakBreaks += 1
    }

    if (trade.result === "WIN") {
      streak += 1
    } else {
      streak = 0
    }
  }

  const baselineBreaks = trades.filter((trade) => trade.rule_followed === false).length
  const baselineRate = baselineBreaks / trades.length
  const streakRate = afterStreakTotal > 0 ? afterStreakBreaks / afterStreakTotal : 0

  if (afterStreakTotal < 2 || streakRate < baselineRate + 0.2) return null

  return {
    id: "rule-break-after-win-streak",
    category: "streak",
    severity: "warning",
    message: "You break rules more often after winning streaks.",
    score: 87,
  }
}

function detectLossStreakEmotion(trades: PatternMemoryTrade[]): PatternMemoryPattern | null {
  const ordered = sortTradesChronologically(trades)
  let lossStreak = 0
  let riskyAfterLossStreak = 0
  let opportunities = 0

  for (const trade of ordered) {
    if (lossStreak >= 2) {
      opportunities += 1
      if (IMPULSIVE_EMOTIONS.has(trade.emotion)) riskyAfterLossStreak += 1
    }

    if (trade.result === "LOSS") lossStreak += 1
    else lossStreak = 0
  }

  if (opportunities < 2 || riskyAfterLossStreak / opportunities < 0.5) return null

  return {
    id: "risky-emotion-after-loss-streak",
    category: "streak",
    severity: "warning",
    message: "Impulsive emotions spike after loss streaks — tighten your reset routine.",
    score: 82,
  }
}

function detectRiskPatterns(
  trades: PatternMemoryTrade[],
  maxRiskPerTrade: number,
): PatternMemoryPattern | null {
  const oversize = trades.filter((trade) => (trade.risk_percent ?? 0) > maxRiskPerTrade)
  if (oversize.length < 2) return null

  const rate = oversize.length / trades.length
  if (rate < 0.25) return null

  return {
    id: "repeated-overrisk",
    category: "risk",
    severity: "warning",
    message: `You exceed your ${maxRiskPerTrade}% risk rule on ${Math.round(rate * 100)}% of recent trades.`,
    score: 80 + rate * 15,
  }
}

function detectPlannedVsActualGaps(feedback: PatternMemoryFeedback[]): PatternMemoryPattern[] {
  if (feedback.length === 0) return []

  const gapCounts = new Map<string, number>()
  for (const row of feedback) {
    for (const comparison of row.planned_vs_actual || []) {
      if (comparison.aligned) continue
      gapCounts.set(comparison.field, (gapCounts.get(comparison.field) ?? 0) + 1)
    }
  }

  const patterns: PatternMemoryPattern[] = []
  for (const [field, count] of gapCounts.entries()) {
    if (count < 2) continue
    const rate = count / feedback.length
    if (rate < 0.35) continue

    const messageByField: Record<string, string> = {
      Entry: "Planned entry levels often drift from your actual execution.",
      "Stop loss": "Your actual stop loss frequently diverges from the pre-trade plan.",
      "Take profit": "Take-profit targets often differ from what you planned.",
      Risk: "Actual risk sizing keeps drifting above what you planned.",
      Emotion: "Closing emotion often diverges from your pre-trade emotional state.",
      "Rules followed": "Rule adherence after the trade often breaks from your pre-trade commitment.",
    }

    patterns.push({
      id: `plan-gap-${field.toLowerCase().replace(/\s+/g, "-")}`,
      category: "plan_gap",
      severity: "insight",
      message: messageByField[field] || `Planned vs actual gaps repeat on ${field.toLowerCase()}.`,
      score: 74 + rate * 12,
    })
  }

  return patterns
}

function detectChartVisionPatterns(
  sessions: PatternMemorySession[],
  trades: PatternMemoryTrade[],
): PatternMemoryPattern[] {
  const withVision = sessions.filter(
    (session) =>
      session.screenshot_url ||
      session.planned_context.screenshot_url ||
      session.planned_context.chart_url ||
      (session.vision_score ?? 0) > 0,
  )
  if (withVision.length < 2) return []

  const patterns: PatternMemoryPattern[] = []
  const tradesById = new Map(trades.map((trade) => [String(trade.id), trade]))

  const countertrendLosses = withVision.filter((session) => {
    const vision = session.planned_context.chart_analysis?.vision
    const countertrend =
      vision?.metrics.countertrend ?? session.planned_context.chart_analysis?.countertrend
    if (!countertrend || !session.trade_id) return false
    const trade = tradesById.get(String(session.trade_id))
    return trade?.result === "LOSS"
  })

  if (countertrendLosses.length >= 2) {
    patterns.push({
      id: "chart-countertrend-losses",
      category: "chart_vision",
      severity: "warning",
      message: "Countertrend chart reads are repeating in losing trades — wait for alignment.",
      score: 82,
    })
  }

  const overextendedLosses = withVision.filter((session) => {
    const vision = session.planned_context.chart_analysis?.vision
    const overextended =
      vision?.metrics.overextendedMove ?? session.planned_context.chart_analysis?.overextendedEntry
    if (!overextended || !session.trade_id) return false
    const trade = tradesById.get(String(session.trade_id))
    return trade?.result === "LOSS"
  })

  if (overextendedLosses.length >= 2) {
    patterns.push({
      id: "chart-overextended-losses",
      category: "chart_vision",
      severity: "warning",
      message: "Overextended chart entries are showing up in repeated losses.",
      score: 80,
    })
  }

  const setupBuckets = new Map<string, { wins: number; total: number }>()
  for (const session of withVision) {
    if (!session.trade_id) continue
    const trade = tradesById.get(String(session.trade_id))
    if (!trade) continue
    const setup =
      session.planned_context.chart_analysis?.vision?.detectedSetup ||
      session.planned_context.confirmation_signal ||
      session.planned_context.setup ||
      "unknown"
    const bucket = setupBuckets.get(setup) || { wins: 0, total: 0 }
    bucket.total += 1
    if (trade.result === "WIN") bucket.wins += 1
    setupBuckets.set(setup, bucket)
  }

  for (const [setup, stats] of setupBuckets.entries()) {
    if (stats.total < 2) continue
    const winRate = stats.wins / stats.total
    if (winRate >= 0.6) {
      patterns.push({
        id: `chart-setup-edge-${setup.toLowerCase().replace(/\s+/g, "-").slice(0, 24)}`,
        category: "chart_vision",
        severity: "positive",
        message: `${setup} chart structures have been one of your stronger visual setups.`,
        score: 76 + winRate * 10,
      })
    }
  }

  const highVisionWins = withVision.filter((session) => {
    if (!session.trade_id) return false
    const score =
      session.vision_score ??
      session.planned_context.vision_score ??
      session.planned_context.chart_analysis?.vision?.visionScore ??
      session.planned_context.chart_analysis?.overallScore ??
      0
    const trade = tradesById.get(String(session.trade_id))
    return score >= 75 && trade?.result === "WIN"
  })

  if (highVisionWins.length >= 2) {
    patterns.push({
      id: "chart-high-vision-win-rate",
      category: "chart_vision",
      severity: "positive",
      message: "High Chart Vision scores are correlating with your better outcomes.",
      score: 79,
    })
  }

  return patterns.slice(0, 3)
}

function detectVisualAnnotationMistakes(
  sessions: PatternMemorySession[],
  trades: PatternMemoryTrade[],
): PatternMemoryPattern[] {
  const bundles = sessions
    .filter(
      (session) =>
        session.chart_annotations ||
        session.planned_context.chart_annotations ||
        session.planned_context.visual_analysis?.chartAnnotations,
    )
    .map((session) => {
      const trade = trades.find((row) => String(row.id) === String(session.trade_id))
      return {
        bundle:
          session.chart_annotations ||
          session.planned_context.chart_annotations ||
          session.planned_context.visual_analysis?.chartAnnotations,
        emotion: trade?.emotion_after || trade?.emotion || session.planned_context.emotion,
      }
    })

  if (bundles.length < 2) return []

  const patterns = aggregateVisualMistakePatterns(bundles)
  const topMessage = topVisualMistakeMessage(patterns)
  if (!topMessage || !patterns[0]) return []

  return [
    {
      id: `visual-mistake-${patterns[0].kind}`,
      category: "chart_vision",
      severity: "warning",
      message: topMessage,
      score: 70 + Math.min(patterns[0].count * 4, 20),
    },
    ...patterns.slice(1, 2).map((pattern) => ({
      id: `visual-mistake-${pattern.kind}`,
      category: "chart_vision" as const,
      severity: "insight" as const,
      message: pattern.message,
      score: 65 + Math.min(pattern.count * 3, 15),
    })),
  ]
}

function detectCoachSessionPatterns(
  sessions: PatternMemorySession[],
  feedbackByTradeId: Map<string, PatternMemoryFeedback>,
): PatternMemoryPattern[] {
  const linked = sessions.filter((session) => session.trade_id)
  if (linked.length < 2) return []

  const lowConfidenceLosses = linked.filter((session) => {
    const confidence = session.planned_context.coach_analysis?.confidenceScore
    if (confidence === undefined || confidence >= 50) return false
    const feedback = feedbackByTradeId.get(String(session.trade_id))
    return feedback && feedback.discipline_score < 55
  })

  if (lowConfidenceLosses.length < 2) return []

  return [
    {
      id: "low-confidence-weak-discipline",
      category: "discipline",
      severity: "insight",
      message: "Low pre-entry confidence scores are linking to weaker post-trade discipline.",
      score: 78,
    },
  ]
}

export function generatePatternMemory(input: PatternMemoryInput): PatternMemoryResult {
  const trades = input.trades || []
  const feedback = input.feedback || []
  const sessions = input.sessions || []

  if (trades.length < MIN_TRADES_FOR_PATTERNS) {
    return {
      hasEnoughData: false,
      tradeCount: trades.length,
      coachLinkedCount: feedback.length,
      patterns: [],
      emptyMessage: `Log at least ${MIN_TRADES_FOR_PATTERNS} trades to unlock Pattern Memory. You have ${trades.length} so far.`,
    }
  }

  const feedbackByTradeId = new Map(
    feedback.map((row) => [String(row.trade_id), row]),
  )

  const patterns: PatternMemoryPattern[] = [
    ...detectRepeatedMistakes(trades),
    ...detectSessionDiscipline(trades, feedbackByTradeId, input.maxRiskPerTrade),
    ...detectStrategyPerformance(trades),
    ...detectPlannedVsActualGaps(feedback),
    ...detectChartVisionPatterns(sessions, trades),
    ...detectVisualAnnotationMistakes(sessions, trades),
    ...detectCoachSessionPatterns(sessions, feedbackByTradeId),
  ]

  const singletonPatterns = [
    detectFomoAfterLosses(trades),
    detectRevengeAfterLosses(trades),
    detectEuphoricDisciplineDrop(trades, feedbackByTradeId, input.maxRiskPerTrade),
    detectCounterTrendQuality(trades, feedbackByTradeId, input.maxRiskPerTrade),
    detectRuleBreaksAfterWinStreak(trades),
    detectLossStreakEmotion(trades),
    detectRiskPatterns(trades, input.maxRiskPerTrade),
  ].filter((pattern): pattern is PatternMemoryPattern => pattern !== null)

  patterns.push(...singletonPatterns)

  const unique = new Map<string, PatternMemoryPattern>()
  for (const pattern of patterns) {
    const existing = unique.get(pattern.id)
    if (!existing || pattern.score > existing.score) {
      unique.set(pattern.id, pattern)
    }
  }

  const sorted = [...unique.values()].sort((a, b) => b.score - a.score).slice(0, 8)

  return {
    hasEnoughData: true,
    tradeCount: trades.length,
    coachLinkedCount: feedback.length,
    patterns: sorted,
    emptyMessage:
      sorted.length === 0
        ? "Not enough recurring behavior yet. Keep logging trades and coach sessions to build pattern memory."
        : "",
  }
}
