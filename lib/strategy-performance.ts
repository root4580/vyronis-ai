import { getSignedPnL } from "@/lib/trade-utils"

export type StrategyTrade = {
  id?: string
  pair?: string
  pnl: number
  result: string
  strategy_name: string | null
  research_strategy_id?: string | null
}

export type StrategyStats = {
  id: string | null
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
  groupBy: "strategy_name" | "research_strategy_id"
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

function buildStrategyStats(
  id: string | null,
  name: string,
  trades: StrategyTrade[],
): StrategyStats {
  const wins = trades.filter((t) => t.result === "WIN").length
  const losses = trades.filter((t) => t.result === "LOSS").length
  const totalPnL = trades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)

  return {
    id,
    name,
    tradeCount: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
    totalPnL,
    avgRR: calculateAvgRR(trades),
  }
}

export function buildStrategyPerformance(
  trades: StrategyTrade[],
  options?: { groupBy?: "strategy_name" | "research_strategy_id" },
): StrategyPerformanceSummary {
  const groupBy = options?.groupBy ?? "strategy_name"

  if (trades.length === 0) {
    return {
      strategies: [],
      bestStrategy: null,
      worstStrategy: null,
      totalTrades: 0,
      hasStrategyData: false,
      groupBy,
    }
  }

  const grouped = new Map<string, { id: string | null; name: string; trades: StrategyTrade[] }>()

  for (const trade of trades) {
    if (groupBy === "research_strategy_id" && trade.research_strategy_id) {
      const id = trade.research_strategy_id
      const bucket = grouped.get(id) || {
        id,
        name: trade.strategy_name?.trim() || "Research Strategy",
        trades: [],
      }
      bucket.trades.push(trade)
      grouped.set(id, bucket)
      continue
    }

    const name = normalizeStrategyName(trade.strategy_name)
    const key = `name:${name}`
    const bucket = grouped.get(key) || { id: null, name, trades: [] }
    bucket.trades.push(trade)
    grouped.set(key, bucket)
  }

  const hasNamedStrategy =
    groupBy === "research_strategy_id"
      ? trades.some((t) => t.research_strategy_id)
      : trades.some((t) => t.strategy_name?.trim())

  const strategies = Array.from(grouped.values())
    .map((entry) => buildStrategyStats(entry.id, entry.name, entry.trades))
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
    groupBy,
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
