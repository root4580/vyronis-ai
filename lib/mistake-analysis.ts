import { parseMistakeTags } from "@/lib/trade-form-config"
import { getSignedPnL } from "@/lib/trade-utils"

export type MistakeTrade = {
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  session?: string | null
  risk_percent?: number | null
  rule_followed?: boolean | null
  confirmation_signal?: string | null
  mistake_tags?: string | null
  strategy_name?: string | null
  trade_date?: string | null
  created_at: string
}

export type MistakeEntry = {
  id: string
  label: string
  count: number
  lossCount: number
  lossRate: number
  totalLossAmount: number
  frequency: number
  dangerous: boolean
}

export type MistakeInsight = {
  id: string
  message: string
  type: "warning" | "success" | "insight"
}

export type MistakeAnalysis = {
  hasData: boolean
  tradeCount: number
  leaderboard: MistakeEntry[]
  lossLinked: MistakeEntry[]
  dangerousBehaviors: MistakeEntry[]
  insights: MistakeInsight[]
  disciplineScore: number
  emotionalConsistencyScore: number
  mostImproved: { label: string; improvement: number } | null
  topRepeated: MistakeEntry | null
  strategyInsight: string | null
  biggestLossCauses: MistakeEntry[]
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

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])
const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])

type BehaviorDef = {
  id: string
  label: string
  dangerous: boolean
  matches: (trade: MistakeTrade, context: AnalysisContext) => boolean
}

type AnalysisContext = {
  tradesPerDay: Map<string, number>
}

function getTradeDay(trade: MistakeTrade): string {
  return (trade.trade_date || trade.created_at).split("T")[0]
}

function getTradeTimestamp(trade: MistakeTrade): number {
  return new Date(trade.trade_date || trade.created_at).getTime()
}

function isLoss(trade: MistakeTrade): boolean {
  return trade.result === "LOSS"
}

function hasTag(trade: MistakeTrade, tag: string): boolean {
  return parseMistakeTags(trade.mistake_tags).includes(tag)
}

function isCounterTrend(trade: MistakeTrade): boolean {
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

function buildContext(trades: MistakeTrade[]): AnalysisContext {
  const tradesPerDay = new Map<string, number>()
  for (const trade of trades) {
    const day = getTradeDay(trade)
    tradesPerDay.set(day, (tradesPerDay.get(day) || 0) + 1)
  }
  return { tradesPerDay }
}

const BEHAVIOR_DEFS: BehaviorDef[] = [
  {
    id: "fomo",
    label: "FOMO",
    dangerous: true,
    matches: (t) => t.emotion === "FOMO" || t.emotion_after === "FOMO",
  },
  {
    id: "revenge",
    label: "Revenge trading",
    dangerous: true,
    matches: (t) => t.emotion === "Revenge" || hasTag(t, "Revenge trade"),
  },
  {
    id: "overrisking",
    label: "Overrisking",
    dangerous: true,
    matches: (t) => (t.risk_percent != null && t.risk_percent > 1) || hasTag(t, "Oversized"),
  },
  {
    id: "counter-trend",
    label: "Counter-trend entries",
    dangerous: true,
    matches: (t) => isCounterTrend(t),
  },
  {
    id: "early-entry",
    label: "Early entries",
    dangerous: true,
    matches: (t) => hasTag(t, "Chased price") || hasTag(t, "Late entry"),
  },
  {
    id: "no-confirmation",
    label: "No confirmation",
    dangerous: true,
    matches: (t) => !t.confirmation_signal || hasTag(t, "No confirmation"),
  },
  {
    id: "moved-stop",
    label: "Moving stop loss",
    dangerous: true,
    matches: (t) => hasTag(t, "Moved stop"),
  },
  {
    id: "overtrading",
    label: "Overtrading",
    dangerous: true,
    matches: (t, ctx) => (ctx.tradesPerDay.get(getTradeDay(t)) || 0) > 3,
  },
]

function countBehavior(
  trades: MistakeTrade[],
  behavior: BehaviorDef,
  context: AnalysisContext,
): MistakeEntry {
  let count = 0
  let lossCount = 0
  let totalLossAmount = 0

  for (const trade of trades) {
    if (!behavior.matches(trade, context)) continue
    count++
    if (isLoss(trade)) {
      lossCount++
      totalLossAmount += Math.abs(getSignedPnL(trade.pnl, trade.result))
    }
  }

  return {
    id: behavior.id,
    label: behavior.label,
    count,
    lossCount,
    lossRate: count > 0 ? Math.round((lossCount / count) * 100) : 0,
    totalLossAmount,
    frequency: trades.length > 0 ? Math.round((count / trades.length) * 100) : 0,
    dangerous: behavior.dangerous,
  }
}

function countTagMistakes(trades: MistakeTrade[]): MistakeEntry[] {
  const map = new Map<string, { count: number; lossCount: number; totalLossAmount: number }>()

  for (const trade of trades) {
    for (const tag of parseMistakeTags(trade.mistake_tags)) {
      const current = map.get(tag) || { count: 0, lossCount: 0, totalLossAmount: 0 }
      current.count++
      if (isLoss(trade)) {
        current.lossCount++
        current.totalLossAmount += Math.abs(getSignedPnL(trade.pnl, trade.result))
      }
      map.set(tag, current)
    }
  }

  return Array.from(map.entries()).map(([label, stats]) => ({
    id: `tag-${label.toLowerCase().replace(/\s+/g, "-")}`,
    label,
    count: stats.count,
    lossCount: stats.lossCount,
    lossRate: stats.count > 0 ? Math.round((stats.lossCount / stats.count) * 100) : 0,
    totalLossAmount: stats.totalLossAmount,
    frequency: trades.length > 0 ? Math.round((stats.count / trades.length) * 100) : 0,
    dangerous: ["Revenge trade", "Moved stop", "Oversized", "No confirmation", "Chased price"].includes(label),
  }))
}

function mergeLeaderboard(behaviors: MistakeEntry[], tags: MistakeEntry[]): MistakeEntry[] {
  const merged = new Map<string, MistakeEntry>()

  for (const entry of [...behaviors, ...tags]) {
    const existing = merged.get(entry.label)
    if (!existing || entry.count > existing.count) {
      merged.set(entry.label, entry)
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.count - a.count)
}

function calculateDisciplineScore(trades: MistakeTrade[]): number {
  if (trades.length === 0) return 0

  const rulesScore =
    (trades.filter((t) => t.rule_followed !== false).length / trades.length) * 70
  const tagged = trades.filter((t) => parseMistakeTags(t.mistake_tags).length > 0).length
  const cleanRate = 1 - tagged / trades.length
  const tagScore = cleanRate * 30

  return Math.round(Math.min(100, rulesScore + tagScore))
}

function calculateEmotionalConsistency(trades: MistakeTrade[]): number {
  if (trades.length === 0) return 0

  const stableCount = trades.filter((t) => STABLE_EMOTIONS.has(t.emotion)).length
  const impulsiveCount = trades.filter((t) => IMPULSIVE_EMOTIONS.has(t.emotion)).length

  const stableScore = (stableCount / trades.length) * 55
  const impulsePenalty = (impulsiveCount / trades.length) * 35
  const uniqueEmotions = new Set(trades.map((t) => t.emotion)).size
  const variancePenalty = Math.min(20, (uniqueEmotions / trades.length) * 40)

  return Math.round(Math.max(0, Math.min(100, stableScore + 45 - impulsePenalty - variancePenalty)))
}

function findMostImproved(trades: MistakeTrade[], context: AnalysisContext): { label: string; improvement: number } | null {
  if (trades.length < 6) return null

  const sorted = [...trades].sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
  const mid = Math.floor(sorted.length / 2)
  const first = sorted.slice(0, mid)
  const second = sorted.slice(mid)

  let best: { label: string; improvement: number } | null = null

  for (const behavior of BEHAVIOR_DEFS) {
    const firstRate = first.filter((t) => behavior.matches(t, context)).length / first.length
    const secondRate = second.filter((t) => behavior.matches(t, context)).length / second.length
    const improvement = Math.round((firstRate - secondRate) * 100)
    if (improvement >= 8 && (!best || improvement > best.improvement)) {
      best = { label: behavior.label, improvement }
    }
  }

  for (const tag of countTagMistakes(trades)) {
    const firstRate = first.filter((t) => hasTag(t, tag.label)).length / first.length
    const secondRate = second.filter((t) => hasTag(t, tag.label)).length / second.length
    const improvement = Math.round((firstRate - secondRate) * 100)
    if (improvement >= 8 && (!best || improvement > best.improvement)) {
      best = { label: tag.label, improvement }
    }
  }

  return best
}

function normalizeSession(session?: string | null): string {
  if (!session) return "Unknown session"
  if (session.toLowerCase().includes("london")) return "London session"
  if (session.toLowerCase().includes("new york") || session.toLowerCase().includes("ny")) return "New York session"
  if (session.toLowerCase().includes("asia")) return "Asia session"
  return session
}

function winRate(trades: MistakeTrade[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter((t) => t.result === "WIN").length / trades.length) * 100)
}

function buildInsights(trades: MistakeTrade[], behaviors: MistakeEntry[], context: AnalysisContext): MistakeInsight[] {
  const insights: MistakeInsight[] = []
  const losses = trades.filter(isLoss)

  const fomo = behaviors.find((b) => b.id === "fomo")
  if (fomo && fomo.lossCount > 0 && losses.length > 0) {
    const share = Math.round((fomo.lossCount / losses.length) * 100)
    if (share >= 15) {
      insights.push({
        id: "fomo-losses",
        type: "warning",
        message: `FOMO caused ${share}% of your losses across ${fomo.count} impulsive entries.`,
      })
    }
  }

  const sessionImpulse = new Map<string, number>()
  for (const trade of trades) {
    if (trade.emotion === "FOMO" || trade.emotion === "Revenge" || IMPULSIVE_EMOTIONS.has(trade.emotion)) {
      const session = normalizeSession(trade.session)
      sessionImpulse.set(session, (sessionImpulse.get(session) || 0) + 1)
    }
  }
  let topImpulsiveSession = ""
  let topImpulsiveCount = 0
  sessionImpulse.forEach((count, session) => {
    if (count > topImpulsiveCount) {
      topImpulsiveCount = count
      topImpulsiveSession = session
    }
  })
  if (topImpulsiveSession && topImpulsiveCount >= 2) {
    insights.push({
      id: "session-impulse",
      type: "warning",
      message: `${topImpulsiveSession} has the most impulsive entries (${topImpulsiveCount} trades).`,
    })
  }

  const calmTrades = trades.filter((t) => STABLE_EMOTIONS.has(t.emotion))
  if (calmTrades.length >= 2) {
    const calmRate = winRate(calmTrades)
    const overall = winRate(trades)
    if (calmRate >= overall) {
      insights.push({
        id: "calm-best",
        type: "success",
        message: `Calm emotional state performs best at ${calmRate}% win rate vs ${overall}% overall.`,
      })
    }
  }

  const counterTrendTrades = trades.filter((t) => isCounterTrend(t))
  const withTrendTrades = trades.filter((t) => t.confirmation_signal && !isCounterTrend(t))
  if (counterTrendTrades.length >= 2 && withTrendTrades.length >= 2) {
    const counterRate = winRate(counterTrendTrades)
    const trendRate = winRate(withTrendTrades)
    const diff = trendRate - counterRate
    if (diff >= 10) {
      insights.push({
        id: "counter-trend",
        type: "warning",
        message: `Counter-trend trades underperform by ${diff}% (${counterRate}% vs ${trendRate}% win rate).`,
      })
    }
  }

  const revenge = behaviors.find((b) => b.id === "revenge")
  if (revenge && revenge.count >= 2) {
    insights.push({
      id: "revenge-warning",
      type: "warning",
      message: `Revenge trading flagged on ${revenge.count} trades with ${revenge.lossRate}% ending in losses.`,
    })
  }

  const overrisk = behaviors.find((b) => b.id === "overrisking")
  if (overrisk && overrisk.count >= 2) {
    insights.push({
      id: "overrisk",
      type: "warning",
      message: `Overrisking detected on ${overrisk.count} trades — ${overrisk.lossRate}% converted into losses.`,
    })
  }

  if (insights.length === 0 && trades.length >= 3) {
    insights.push({
      id: "clean-process",
      type: "success",
      message: "No dominant mistake pattern detected — keep tagging trades for sharper feedback.",
    })
  }

  return insights.slice(0, 6)
}

function buildStrategyInsight(trades: MistakeTrade[]): string | null {
  const byStrategy = new Map<string, MistakeTrade[]>()
  for (const trade of trades) {
    const name = trade.strategy_name?.trim() || "Unassigned"
    const bucket = byStrategy.get(name) || []
    bucket.push(trade)
    byStrategy.set(name, bucket)
  }

  let worstStrategy = ""
  let worstLossRate = -1
  let worstMistake = ""

  byStrategy.forEach((bucket, strategy) => {
    if (bucket.length < 2) return
    const losses = bucket.filter(isLoss)
    const lossRate = losses.length / bucket.length
    if (lossRate <= worstLossRate) return

    const tags = countTagMistakes(bucket)
    const topTag = tags[0]
    worstLossRate = lossRate
    worstStrategy = strategy
    worstMistake = topTag?.label || "execution errors"
  })

  if (!worstStrategy || worstLossRate < 0.4) return null
  return `${worstStrategy} shows the highest mistake density — focus on ${worstMistake}.`
}

export function buildMistakeAnalysis(trades: MistakeTrade[]): MistakeAnalysis {
  if (trades.length === 0) {
    return {
      hasData: false,
      tradeCount: 0,
      leaderboard: [],
      lossLinked: [],
      dangerousBehaviors: [],
      insights: [],
      disciplineScore: 0,
      emotionalConsistencyScore: 0,
      mostImproved: null,
      topRepeated: null,
      strategyInsight: null,
      biggestLossCauses: [],
    }
  }

  const context = buildContext(trades)
  const behaviorEntries = BEHAVIOR_DEFS.map((b) => countBehavior(trades, b, context)).filter((e) => e.count > 0)
  const tagEntries = countTagMistakes(trades)
  const leaderboard = mergeLeaderboard(behaviorEntries, tagEntries)
  const lossLinked = [...leaderboard]
    .filter((e) => e.lossCount > 0)
    .sort((a, b) => b.lossCount - a.lossCount)
  const biggestLossCauses = [...leaderboard]
    .filter((e) => e.totalLossAmount > 0)
    .sort((a, b) => b.totalLossAmount - a.totalLossAmount)
  const dangerousBehaviors = [...behaviorEntries]
    .filter((e) => e.dangerous && e.count > 0)
    .sort((a, b) => b.frequency - a.frequency)

  return {
    hasData: true,
    tradeCount: trades.length,
    leaderboard: leaderboard.slice(0, 8),
    lossLinked: lossLinked.slice(0, 6),
    dangerousBehaviors: dangerousBehaviors.slice(0, 8),
    insights: buildInsights(trades, behaviorEntries, context),
    disciplineScore: calculateDisciplineScore(trades),
    emotionalConsistencyScore: calculateEmotionalConsistency(trades),
    mostImproved: findMostImproved(trades, context),
    topRepeated: leaderboard[0] ?? null,
    strategyInsight: buildStrategyInsight(trades),
    biggestLossCauses: biggestLossCauses.slice(0, 6),
  }
}

export function getTopMistakeInsight(trades: MistakeTrade[]): MistakeInsight | null {
  const analysis = buildMistakeAnalysis(trades)
  return analysis.insights[0] ?? null
}
