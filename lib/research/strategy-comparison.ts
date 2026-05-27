import { getSignedPnL } from "@/lib/trade-utils"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import type { ResearchStrategyRecord } from "@/lib/research/types"

export type ResearchStrategyStats = {
  strategyId: string
  name: string
  color: string
  tradeCount: number
  wins: number
  losses: number
  winRate: number
  totalPnL: number
  avgRR: number
  maxDrawdown: number
  bestSession: { name: string; pnl: number; winRate: number; tradeCount: number } | null
  bestPair: { pair: string; pnl: number; winRate: number; tradeCount: number } | null
}

export type ResearchComparisonSummary = {
  strategies: ResearchStrategyStats[]
  totalTrades: number
  hasData: boolean
}

function calculateAvgRR(trades: AnalyticsTradeRow[]): number {
  const wins = trades.filter((t) => t.result === "WIN")
  const losses = trades.filter((t) => t.result === "LOSS")
  if (wins.length === 0 || losses.length === 0) return 0

  const avgWin =
    wins.reduce((sum, t) => sum + Math.abs(getSignedPnL(t.pnl, t.result)), 0) / wins.length
  const avgLoss =
    losses.reduce((sum, t) => sum + Math.abs(getSignedPnL(t.pnl, t.result)), 0) / losses.length

  return avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : 0
}

function calculateMaxDrawdown(trades: AnalyticsTradeRow[]): number {
  const sorted = [...trades].sort((a, b) => {
    const aTime = new Date(a.closed_at || a.trade_date || a.created_at).getTime()
    const bTime = new Date(b.closed_at || b.trade_date || b.created_at).getTime()
    return aTime - bTime
  })

  let equity = 0
  let peak = 0
  let maxDrawdown = 0

  for (const trade of sorted) {
    equity += getSignedPnL(trade.pnl, trade.result)
    peak = Math.max(peak, equity)
    maxDrawdown = Math.max(maxDrawdown, peak - equity)
  }

  return Math.round(maxDrawdown * 100) / 100
}

function bestSegment(
  trades: AnalyticsTradeRow[],
  key: "session" | "pair",
): { name: string; pnl: number; winRate: number; tradeCount: number } | null {
  const grouped = new Map<string, AnalyticsTradeRow[]>()

  for (const trade of trades) {
    const label =
      key === "session"
        ? trade.session?.trim() || "Unknown Session"
        : trade.pair?.trim() || "Unknown"
    const bucket = grouped.get(label) || []
    bucket.push(trade)
    grouped.set(label, bucket)
  }

  let best: { name: string; pnl: number; winRate: number; tradeCount: number } | null = null

  grouped.forEach((bucket, name) => {
    const pnl = bucket.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
    const wins = bucket.filter((t) => t.result === "WIN").length
    const candidate = {
      name,
      pnl,
      winRate: bucket.length > 0 ? Math.round((wins / bucket.length) * 100) : 0,
      tradeCount: bucket.length,
    }
    if (!best || candidate.pnl > best.pnl) {
      best = candidate
    }
  })

  return best
}

export function buildResearchStrategyComparison(
  trades: AnalyticsTradeRow[],
  strategies: ResearchStrategyRecord[],
): ResearchComparisonSummary {
  if (trades.length === 0) {
    return { strategies: [], totalTrades: 0, hasData: false }
  }

  const strategyMap = new Map(strategies.map((strategy) => [strategy.id, strategy]))
  const grouped = new Map<string, AnalyticsTradeRow[]>()

  for (const trade of trades) {
    const strategyId = trade.research_strategy_id
    if (!strategyId) continue
    const bucket = grouped.get(strategyId) || []
    bucket.push(trade)
    grouped.set(strategyId, bucket)
  }

  const stats: ResearchStrategyStats[] = Array.from(grouped.entries()).map(
    ([strategyId, bucket]) => {
      const meta = strategyMap.get(strategyId)
      const wins = bucket.filter((t) => t.result === "WIN").length
      const losses = bucket.filter((t) => t.result === "LOSS").length
      const totalPnL = bucket.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)

      const bestPairSegment = bestSegment(bucket, "pair")

      return {
        strategyId,
        name: meta?.name || tradeStrategyFallbackName(bucket),
        color: meta?.color || "#22d3ee",
        tradeCount: bucket.length,
        wins,
        losses,
        winRate: bucket.length > 0 ? Math.round((wins / bucket.length) * 100) : 0,
        totalPnL,
        avgRR: calculateAvgRR(bucket),
        maxDrawdown: calculateMaxDrawdown(bucket),
        bestSession: bestSegment(bucket, "session"),
        bestPair: bestPairSegment
          ? {
              pair: bestPairSegment.name,
              pnl: bestPairSegment.pnl,
              winRate: bestPairSegment.winRate,
              tradeCount: bestPairSegment.tradeCount,
            }
          : null,
      }
    },
  )

  stats.sort((a, b) => b.totalPnL - a.totalPnL)

  return {
    strategies: stats,
    totalTrades: trades.length,
    hasData: stats.length > 0,
  }
}

function tradeStrategyFallbackName(trades: AnalyticsTradeRow[]): string {
  return trades[0]?.strategy_name?.trim() || "Unnamed Strategy"
}
