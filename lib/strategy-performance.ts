import { getSignedPnL } from "@/lib/trade-utils"

export type StrategyTrade = {
  pnl: number
  result: string
  strategy_name: string | null
}

export type StrategyStats = {
  name: string
  tradeCount: number
  wins: number
  losses: number
  winRate: number
  totalPnL: number
  avgRR: number
}

export type StrategyPerformanceSummary = {
  strategies: StrategyStats[]
  bestStrategy: StrategyStats | null
  worstStrategy: StrategyStats | null
  totalTrades: number
  hasStrategyData: boolean
}

function normalizeStrategyName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : "Unassigned"
}

function calculateAvgRR(trades: StrategyTrade[]): number {
  const wins = trades.filter((t) => t.result === "WIN")
  const losses = trades.filter((t) => t.result === "LOSS")

  if (wins.length === 0 || losses.length === 0) return 0

  const avgWin =
    wins.reduce((sum, t) => sum + Math.abs(getSignedPnL(t.pnl, t.result)), 0) / wins.length
  const avgLoss =
    losses.reduce((sum, t) => sum + Math.abs(getSignedPnL(t.pnl, t.result)), 0) / losses.length

  return avgLoss > 0 ? avgWin / avgLoss : 0
}

function buildStrategyStats(name: string, trades: StrategyTrade[]): StrategyStats {
  const wins = trades.filter((t) => t.result === "WIN").length
  const losses = trades.filter((t) => t.result === "LOSS").length
  const totalPnL = trades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)

  return {
    name,
    tradeCount: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
    totalPnL,
    avgRR: calculateAvgRR(trades),
  }
}

export function buildStrategyPerformance(trades: StrategyTrade[]): StrategyPerformanceSummary {
  if (trades.length === 0) {
    return {
      strategies: [],
      bestStrategy: null,
      worstStrategy: null,
      totalTrades: 0,
      hasStrategyData: false,
    }
  }

  const grouped = new Map<string, StrategyTrade[]>()

  for (const trade of trades) {
    const name = normalizeStrategyName(trade.strategy_name)
    const bucket = grouped.get(name) || []
    bucket.push(trade)
    grouped.set(name, bucket)
  }

  const hasNamedStrategy = trades.some((t) => t.strategy_name?.trim())
  const strategies = Array.from(grouped.entries())
    .map(([name, bucket]) => buildStrategyStats(name, bucket))
    .sort((a, b) => b.totalPnL - a.totalPnL)

  const ranked = strategies.filter((s) => s.tradeCount > 0)
  const bestStrategy =
    ranked.length > 0
      ? ranked.reduce((best, current) => (current.totalPnL > best.totalPnL ? current : best))
      : null
  const worstStrategy =
    ranked.length > 0
      ? ranked.reduce((worst, current) => (current.totalPnL < worst.totalPnL ? current : worst))
      : null

  return {
    strategies,
    bestStrategy,
    worstStrategy,
    totalTrades: trades.length,
    hasStrategyData: hasNamedStrategy,
  }
}

export function formatStrategyPnL(value: number): string {
  const abs = Math.abs(value)
  const formatted = Number.isInteger(abs) ? String(abs) : abs.toFixed(2)
  return value >= 0 ? `+$${formatted}` : `-$${formatted}`
}

export function formatAvgRR(value: number): string {
  if (value <= 0) return "—"
  return `${value.toFixed(2)}R`
}
