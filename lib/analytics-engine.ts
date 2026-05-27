import { getSignedPnL } from "@/lib/trade-utils"

export type AnalyticsTrade = {
  pair: string
  result: string
  pnl: number
  session: string | null
  emotion: string
  rule_followed: boolean | null
  created_at: string
  trade_date: string | null
}

export type PairStats = {
  pair: string
  tradeCount: number
  wins: number
  totalPnL: number
  winRate: number
}

export type SessionPerformance = {
  name: string
  pnl: number
  winRate: number
  tradeCount: number
}

export type StreakInfo = {
  current: { count: number; type: "win" | "loss" | "neutral" }
  longestWin: number
  longestLoss: number
}

export type AdvancedAnalytics = {
  bestPair: PairStats | null
  worstPair: PairStats | null
  consistencyScore: number
  avgRR: number
  avgWin: number
  avgLoss: number
  streaks: StreakInfo
  sessionPerformance: SessionPerformance[]
  hasData: boolean
  tradeCount: number
}

const MIN_GROUP_SIZE = 2

function buildPairStats(trades: AnalyticsTrade[]): PairStats[] {
  const grouped = new Map<string, AnalyticsTrade[]>()

  for (const trade of trades) {
    const bucket = grouped.get(trade.pair) || []
    bucket.push(trade)
    grouped.set(trade.pair, bucket)
  }

  return Array.from(grouped.entries())
    .map(([pair, bucket]) => {
      const wins = bucket.filter((t) => t.result === "WIN").length
      const totalPnL = bucket.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
      return {
        pair,
        tradeCount: bucket.length,
        wins,
        totalPnL,
        winRate: bucket.length > 0 ? Math.round((wins / bucket.length) * 100) : 0,
      }
    })
    .filter((s) => s.tradeCount >= MIN_GROUP_SIZE)
    .sort((a, b) => b.totalPnL - a.totalPnL)
}

function calculateAvgRR(trades: AnalyticsTrade[]): { avgRR: number; avgWin: number; avgLoss: number } {
  const wins = trades.filter((t) => t.result === "WIN")
  const losses = trades.filter((t) => t.result === "LOSS")

  if (wins.length === 0 || losses.length === 0) {
    return { avgRR: 0, avgWin: 0, avgLoss: 0 }
  }

  const avgWin = wins.reduce((sum, t) => sum + Math.abs(getSignedPnL(t.pnl, t.result)), 0) / wins.length
  const avgLoss = losses.reduce((sum, t) => sum + Math.abs(getSignedPnL(t.pnl, t.result)), 0) / losses.length

  return {
    avgWin,
    avgLoss,
    avgRR: avgLoss > 0 ? avgWin / avgLoss : 0,
  }
}

function calculateConsistency(trades: AnalyticsTrade[]): number {
  if (trades.length < 3) return 0

  const rulesScore =
    (trades.filter((t) => t.rule_followed !== false).length / trades.length) * 35
  const emotional = trades.filter((t) => !["FOMO", "Revenge", "Euphoric"].includes(t.emotion))
  const emotionScore = (emotional.length / trades.length) * 25

  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.trade_date || a.created_at).getTime() -
      new Date(b.trade_date || b.created_at).getTime(),
  )
  const results = sorted.map((t) => t.result)
  let alternations = 0
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== results[i - 1] && results[i] !== "BREAKEVEN") alternations++
  }
  const streakScore = Math.max(0, 40 - (alternations / Math.max(1, results.length - 1)) * 40)

  return Math.round(Math.min(100, rulesScore + emotionScore + streakScore))
}

function calculateStreaks(trades: AnalyticsTrade[]): StreakInfo {
  if (trades.length === 0) {
    return {
      current: { count: 0, type: "neutral" },
      longestWin: 0,
      longestLoss: 0,
    }
  }

  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.trade_date || a.created_at).getTime() -
      new Date(b.trade_date || b.created_at).getTime(),
  )

  let longestWin = 0
  let longestLoss = 0
  let run = 0
  let runType: "WIN" | "LOSS" | null = null

  for (const trade of sorted) {
    if (trade.result === "WIN" || trade.result === "LOSS") {
      if (trade.result === runType) run++
      else {
        runType = trade.result as "WIN" | "LOSS"
        run = 1
      }
      if (runType === "WIN") longestWin = Math.max(longestWin, run)
      else longestLoss = Math.max(longestLoss, run)
    }
  }

  const last = sorted[sorted.length - 1]
  let currentCount = 0
  const currentType = last.result === "WIN" ? "win" : last.result === "LOSS" ? "loss" : "neutral"

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === last.result) currentCount++
    else if (sorted[i].result === "WIN" || sorted[i].result === "LOSS") break
  }

  return {
    current: { count: currentCount, type: currentType as "win" | "loss" | "neutral" },
    longestWin,
    longestLoss,
  }
}

function buildSessionPerformance(trades: AnalyticsTrade[]): SessionPerformance[] {
  const grouped = new Map<string, AnalyticsTrade[]>()

  for (const trade of trades) {
    const name = trade.session || "Unknown"
    const bucket = grouped.get(name) || []
    bucket.push(trade)
    grouped.set(name, bucket)
  }

  return Array.from(grouped.entries())
    .map(([name, bucket]) => {
      const wins = bucket.filter((t) => t.result === "WIN").length
      const pnl = bucket.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
      return {
        name,
        pnl,
        winRate: bucket.length > 0 ? Math.round((wins / bucket.length) * 100) : 0,
        tradeCount: bucket.length,
      }
    })
    .sort((a, b) => b.pnl - a.pnl)
}

export function buildAdvancedAnalytics(trades: AnalyticsTrade[]): AdvancedAnalytics {
  if (trades.length === 0) {
    return {
      bestPair: null,
      worstPair: null,
      consistencyScore: 0,
      avgRR: 0,
      avgWin: 0,
      avgLoss: 0,
      streaks: {
        current: { count: 0, type: "neutral" },
        longestWin: 0,
        longestLoss: 0,
      },
      sessionPerformance: [],
      hasData: false,
      tradeCount: 0,
    }
  }

  const pairStats = buildPairStats(trades)
  const { avgRR, avgWin, avgLoss } = calculateAvgRR(trades)

  return {
    bestPair: pairStats[0] ?? null,
    worstPair: pairStats.length > 1 ? pairStats[pairStats.length - 1] : pairStats[0] ?? null,
    consistencyScore: calculateConsistency(trades),
    avgRR,
    avgWin,
    avgLoss,
    streaks: calculateStreaks(trades),
    sessionPerformance: buildSessionPerformance(trades),
    hasData: true,
    tradeCount: trades.length,
  }
}

export function formatRR(value: number): string {
  if (value <= 0) return "—"
  return `${value.toFixed(2)}R`
}
