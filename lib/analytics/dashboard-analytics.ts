import { buildMistakeAnalysis } from "@/lib/mistake-analysis"
import type {
  AnalyticsTradeRow,
  DashboardAnalyticsSnapshot,
  EmotionFrequencyItem,
  EquityCurvePoint,
  SetupBreakdownItem,
  SetupDisplayBucket,
  WeeklyTrendPoint,
} from "@/lib/analytics/types"
import { resolveStoredSetupScore } from "@/lib/trade-coach/setup-score-engine"
import { getTradeRiskReward } from "@/lib/trade-form-utils"
import { getSignedPnL } from "@/lib/trade-utils"
import { getTradeTimestamp } from "@/lib/user-settings"

const SETUP_BUCKET_COLORS: Record<SetupDisplayBucket, string> = {
  "A+": "oklch(0.72 0.14 195)",
  A: "oklch(0.68 0.16 165)",
  B: "oklch(0.7 0.18 155)",
  C: "oklch(0.75 0.14 75)",
}

const BEHAVIORAL_CLASSIFICATIONS = new Set(["Impulsive", "Revenge", "Counter-Trend"])

function emptySnapshot(): DashboardAnalyticsSnapshot {
  return {
    hasData: false,
    tradeCount: 0,
    winRate: 0,
    totalPnL: 0,
    averageRR: 0,
    bestSession: null,
    bestPair: null,
    topMistake: null,
    emotionFrequency: [],
    setupBreakdown: [],
    equityCurve: [],
    weeklyTrend: [],
    wins: 0,
    losses: 0,
  }
}

function getSetupDisplayBucket(trade: AnalyticsTradeRow): SetupDisplayBucket {
  const resolved = resolveStoredSetupScore(trade)
  const classification = resolved.classification

  if (classification === "A+") return "A+"

  if (BEHAVIORAL_CLASSIFICATIONS.has(classification) || classification === "C") {
    return "C"
  }

  if (classification === "B") {
    const isASetup =
      /(^|\s)A Setup(\s|$)/i.test(trade.setup) ||
      (trade.setup.toLowerCase().includes("a") && !trade.setup.includes("A+"))
    if (resolved.score >= 80 && resolved.score < 85) return "A"
    if (isASetup && resolved.score >= 75) return "A"
    return "B"
  }

  if (trade.setup.includes("A+")) return "A+"
  if (trade.setup.includes("B")) return "B"
  return "C"
}

function buildSetupBreakdown(trades: AnalyticsTradeRow[]): SetupBreakdownItem[] {
  const buckets: SetupDisplayBucket[] = ["A+", "A", "B", "C"]
  const counts = new Map<SetupDisplayBucket, number>(
    buckets.map((bucket) => [bucket, 0]),
  )

  for (const trade of trades) {
    const bucket = getSetupDisplayBucket(trade)
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }

  const total = trades.length || 1

  return buckets.map((bucket) => ({
    bucket,
    count: counts.get(bucket) ?? 0,
    percentage: Math.round(((counts.get(bucket) ?? 0) / total) * 100),
    color: SETUP_BUCKET_COLORS[bucket],
  }))
}

function buildEmotionFrequency(trades: AnalyticsTradeRow[]): EmotionFrequencyItem[] {
  const counts = new Map<string, number>()

  for (const trade of trades) {
    const emotion = trade.emotion?.trim() || "Unknown"
    counts.set(emotion, (counts.get(emotion) ?? 0) + 1)
  }

  const total = trades.length || 1

  return Array.from(counts.entries())
    .map(([emotion, count]) => ({
      emotion,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

function buildEquityCurve(
  trades: AnalyticsTradeRow[],
  startingBalance: number,
): EquityCurvePoint[] {
  const sorted = [...trades].sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
  const points: EquityCurvePoint[] = [{ date: "Start", equity: startingBalance, pnl: 0 }]

  let cumulative = 0
  for (const trade of sorted) {
    const pnl = getSignedPnL(trade.pnl, trade.result)
    cumulative += pnl
    const date = new Date(trade.trade_date || trade.created_at)
    points.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      equity: startingBalance + cumulative,
      pnl,
    })
  }

  return points
}

function getWeekStartKey(trade: AnalyticsTradeRow): string {
  const date = new Date(trade.trade_date || trade.created_at)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

function buildWeeklyTrend(trades: AnalyticsTradeRow[]): WeeklyTrendPoint[] {
  const grouped = new Map<string, AnalyticsTradeRow[]>()

  for (const trade of trades) {
    const key = getWeekStartKey(trade)
    const bucket = grouped.get(key) ?? []
    bucket.push(trade)
    grouped.set(key, bucket)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([weekKey, bucket]) => {
      const wins = bucket.filter((t) => t.result === "WIN").length
      const pnl = bucket.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
      const weekDate = new Date(weekKey)
      return {
        week: weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pnl,
        trades: bucket.length,
        winRate: bucket.length > 0 ? Math.round((wins / bucket.length) * 100) : 0,
      }
    })
}

function buildBestSession(trades: AnalyticsTradeRow[]) {
  const grouped = new Map<string, AnalyticsTradeRow[]>()

  for (const trade of trades) {
    const name = trade.session?.trim() || "Unknown"
    const bucket = grouped.get(name) ?? []
    bucket.push(trade)
    grouped.set(name, bucket)
  }

  let best: DashboardAnalyticsSnapshot["bestSession"] = null

  for (const [name, bucket] of grouped.entries()) {
    const pnl = bucket.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
    const wins = bucket.filter((t) => t.result === "WIN").length
    const candidate = {
      name,
      pnl,
      winRate: Math.round((wins / bucket.length) * 100),
      tradeCount: bucket.length,
    }
    if (!best || candidate.pnl > best.pnl) best = candidate
  }

  return best
}

function buildBestPair(trades: AnalyticsTradeRow[]) {
  const grouped = new Map<string, AnalyticsTradeRow[]>()

  for (const trade of trades) {
    const bucket = grouped.get(trade.pair) ?? []
    bucket.push(trade)
    grouped.set(trade.pair, bucket)
  }

  let best: DashboardAnalyticsSnapshot["bestPair"] = null

  for (const [pair, bucket] of grouped.entries()) {
    const pnl = bucket.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
    const wins = bucket.filter((t) => t.result === "WIN").length
    const candidate = {
      pair,
      pnl,
      winRate: Math.round((wins / bucket.length) * 100),
      tradeCount: bucket.length,
    }
    if (!best || candidate.pnl > best.pnl) best = candidate
  }

  return best
}

function calculateAverageRR(trades: AnalyticsTradeRow[]): number {
  const values = trades
    .map((trade) => getTradeRiskReward(trade))
    .filter((rr): rr is number => rr != null && rr > 0)

  if (values.length === 0) return 0
  return values.reduce((sum, rr) => sum + rr, 0) / values.length
}

export function buildDashboardAnalytics(
  trades: AnalyticsTradeRow[],
  startingBalance = 10000,
): DashboardAnalyticsSnapshot {
  if (trades.length === 0) return emptySnapshot()

  const wins = trades.filter((t) => t.result === "WIN").length
  const losses = trades.filter((t) => t.result === "LOSS").length
  const decisive = wins + losses
  const totalPnL = trades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
  const mistakeAnalysis = buildMistakeAnalysis(trades)
  const topMistake = mistakeAnalysis.leaderboard[0] ?? null

  return {
    hasData: true,
    tradeCount: trades.length,
    winRate: decisive > 0 ? Math.round((wins / decisive) * 100) : 0,
    totalPnL,
    averageRR: calculateAverageRR(trades),
    bestSession: buildBestSession(trades),
    bestPair: buildBestPair(trades),
    topMistake: topMistake
      ? {
          label: topMistake.label,
          count: topMistake.count,
          frequency: topMistake.frequency,
        }
      : null,
    emotionFrequency: buildEmotionFrequency(trades),
    setupBreakdown: buildSetupBreakdown(trades),
    equityCurve: buildEquityCurve(trades, startingBalance),
    weeklyTrend: buildWeeklyTrend(trades),
    wins,
    losses,
  }
}
