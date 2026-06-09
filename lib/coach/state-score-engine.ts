import { getWeekRange } from "@/lib/ai/weekly-debrief-engine"
import { DAILY_LOSS_NOTIFY_RATIO } from "@/lib/alerts/evaluate-alerts"
import { parseMistakeTags } from "@/lib/trade-form-config"
import { getSignedPnL } from "@/lib/trade-utils"
import { getTradeTimestamp } from "@/lib/user-settings"
import type { UserSettingsForm } from "@/lib/user-settings"
import type { TradeRiskGuardHistoryTrade } from "@/lib/trade-risk-guard"

const NEGATIVE_EMOTIONS = new Set([
  "revenge",
  "impulsive",
  "fearful",
  "fomo",
  "anxious",
  "euphoric",
  "greed",
])
const POSITIVE_EMOTIONS = new Set(["calm", "confident", "disciplined"])
const RECENT_SAMPLE = 10

function normalizeEmotion(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase()
}

function sortTradesNewestFirst(trades: TradeRiskGuardHistoryTrade[]): TradeRiskGuardHistoryTrade[] {
  return [...trades].sort((a, b) => getTradeTimestamp(b) - getTradeTimestamp(a))
}

function recentTrades(trades: TradeRiskGuardHistoryTrade[]): TradeRiskGuardHistoryTrade[] {
  return sortTradesNewestFirst(trades).slice(0, RECENT_SAMPLE)
}

export function countTradesThisWeek(
  trades: TradeRiskGuardHistoryTrade[],
  referenceDate = new Date(),
): number {
  const { start, end } = getWeekRange(referenceDate, 0)
  const startMs = start.getTime()
  const endMs = end.getTime()
  return trades.filter((trade) => {
    const ts = getTradeTimestamp(trade)
    return ts >= startMs && ts <= endMs
  }).length
}

function lossStreakWorsening(trades: TradeRiskGuardHistoryTrade[], consecutiveLosses: number): boolean {
  if (consecutiveLosses < 3 || trades.length < 4) return false
  const sorted = sortTradesNewestFirst(trades)
  const midpoint = Math.floor(sorted.length / 2)
  const recentHalf = sorted.slice(0, midpoint)
  const olderHalf = sorted.slice(midpoint)
  const recentLosses = recentHalf.filter((t) => getSignedPnL(t.pnl, t.result) < 0).length
  const olderLosses = olderHalf.filter((t) => getSignedPnL(t.pnl, t.result) < 0).length
  if (recentHalf.length === 0 || olderHalf.length === 0) return consecutiveLosses >= 3
  return recentLosses / recentHalf.length > olderLosses / olderHalf.length
}

function calculateDisciplineScore(trades: TradeRiskGuardHistoryTrade[]): number {
  if (trades.length === 0) return 0

  const rulesScore =
    (trades.filter((trade) => trade.rule_followed !== false).length / trades.length) * 45
  const tagged = trades.filter((trade) => parseMistakeTags(trade.mistake_tags).length > 0).length
  const cleanRate = 1 - tagged / trades.length
  const tagScore = cleanRate * 55

  return Math.round(Math.min(100, rulesScore + tagScore))
}

export function calculateStateScore(input: {
  trades: TradeRiskGuardHistoryTrade[]
  consecutiveLosses: number
  dailyLossRatio: number
  currentEmotion: string
  maxRiskPerTrade: number
}): number {
  const moodAnswered = Boolean(input.currentEmotion?.trim())
  const weekTradeCount = countTradesThisWeek(input.trades)
  const cleanWeekNoMood = weekTradeCount === 0 && !moodAnswered

  if (cleanWeekNoMood) {
    return 78
  }

  let score = 100
  const { consecutiveLosses, dailyLossRatio, maxRiskPerTrade } = input
  const sample = weekTradeCount === 0 ? [] : recentTrades(input.trades)
  const lastEmotion = moodAnswered
    ? normalizeEmotion(input.currentEmotion)
    : normalizeEmotion(sample[0]?.emotion)

  if (weekTradeCount === 0 && POSITIVE_EMOTIONS.has(lastEmotion)) {
    return Math.min(100, lastEmotion === "confident" ? 90 : 85)
  }

  if (consecutiveLosses >= 5) score -= 40
  else if (consecutiveLosses >= 4) score -= 25
  else if (consecutiveLosses >= 3) score -= 15

  if (lastEmotion === "revenge" || lastEmotion === "impulsive") score -= 20

  if (sample.length > 0) {
    const negativeCount = sample.filter((t) => NEGATIVE_EMOTIONS.has(normalizeEmotion(t.emotion))).length
    if (negativeCount / sample.length >= 0.8) score -= 15

    const oversizedCount = sample.filter((t) => (t.risk_percent ?? 0) > maxRiskPerTrade).length
    if (oversizedCount / sample.length >= 0.5) score -= 10
  }

  if (dailyLossRatio >= DAILY_LOSS_NOTIFY_RATIO) score -= 20

  const disciplineScore = calculateDisciplineScore(input.trades)
  if (disciplineScore < 50) score -= 10
  if (disciplineScore > 70) score += 5

  if (lossStreakWorsening(input.trades, consecutiveLosses)) score -= 5

  const lastThree = sample.slice(0, 3)
  if (
    lastThree.length === 3 &&
    lastThree.every(
      (trade) =>
        trade.rule_followed !== false && parseMistakeTags(trade.mistake_tags).length === 0,
    )
  ) {
    score += 10
  }

  const lastTradeEmotion = normalizeEmotion(sample[0]?.emotion)
  if (lastTradeEmotion === "calm" || lastTradeEmotion === "confident") score += 10

  if (sample[0]?.result === "WIN") score += 5

  return Math.min(100, Math.max(5, Math.round(score)))
}

export function evaluateStateScore(input: {
  trades?: TradeRiskGuardHistoryTrade[]
  consecutiveLosses: number
  dailyLossRatio: number
  currentEmotion: string
  settings?: UserSettingsForm
}): number {
  return calculateStateScore({
    trades: input.trades ?? [],
    consecutiveLosses: input.consecutiveLosses,
    dailyLossRatio: input.dailyLossRatio,
    currentEmotion: input.currentEmotion,
    maxRiskPerTrade: input.settings?.max_risk_per_trade ?? 1,
  })
}
