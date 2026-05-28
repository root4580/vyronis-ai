import type { CommandCenterContext } from "@/lib/command-center/types"
import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import { buildContextualGreeting } from "@/lib/intelligence/greeting-engine"
import { buildBehavioralWarnings } from "@/lib/intelligence/warnings-engine"
import { getTodayTrades } from "@/lib/user-settings"
import { getSignedPnL } from "@/lib/trade-utils"

export type TraderContextInput = {
  trades: Array<{
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
    pair?: string
    setup?: string
    setup_classification?: string | null
  }>
  maxRiskPerTrade: number
  maxTradesPerDay: number
  primaryLeak: PrimaryLeakInsight
  patterns: PatternMemoryPattern[]
  plannedSessions: PlannedCoachSessionItem[]
  traderName?: string | null
  unreadSignalCount?: number
}

export type TraderContextMemory = {
  snapshot: CommandCenterContext["snapshot"]
  greeting: CommandCenterContext["greeting"]
  warnings: CommandCenterContext["warnings"]
  primaryLeak: PrimaryLeakInsight
  topPatterns: PatternMemoryPattern[]
  plannedSessions: PlannedCoachSessionItem[]
}

function computeWinRate(trades: TraderContextInput["trades"]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter((t) => t.result === "WIN").length
  return Math.round((wins / trades.length) * 100)
}

export function buildTraderContextMemory(input: TraderContextInput): TraderContextMemory {
  const todayTrades = getTodayTrades(input.trades)
  const todayPnL = todayTrades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)

  const snapshot: CommandCenterContext["snapshot"] = {
    tradeCount: input.trades.length,
    todayTradeCount: todayTrades.length,
    todayPnL,
    winRate: computeWinRate(input.trades),
    plannedCount: input.plannedSessions.length,
    unreadSignalCount: input.unreadSignalCount ?? 0,
  }

  const greeting = buildContextualGreeting({
    snapshot,
    primaryLeak: input.primaryLeak,
    plannedSessions: input.plannedSessions,
    traderName: input.traderName,
  })

  const warnings = buildBehavioralWarnings({
    primaryLeak: input.primaryLeak,
    patterns: input.patterns,
    plannedSessions: input.plannedSessions,
    todayTradeCount: todayTrades.length,
    maxTradesPerDay: input.maxTradesPerDay,
  })

  return {
    snapshot,
    greeting,
    warnings,
    primaryLeak: input.primaryLeak,
    topPatterns: input.patterns.slice(0, 5),
    plannedSessions: input.plannedSessions,
  }
}
