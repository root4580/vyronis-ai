import { getCalendarDateKey } from "@/lib/journal/trade-date-parser"
import {
  buildPerformanceHeatmap,
  type HeatmapDay,
  type HeatmapMonthStats,
  type HeatmapTrade,
} from "@/lib/performance-heatmap"
import { getSignedPnL } from "@/lib/trade-utils"
import { getTradeTimestamp } from "@/lib/user-settings"

export type JournalCalendarTrade = HeatmapTrade & {
  session?: string | null
  emotion?: string | null
  rule_followed?: boolean | null
  setup_score?: number | null
  mistake_tags?: string | null
  risk_reward?: number | null
  import_source?: string | null
}

export type JournalDayTone = "win" | "loss" | "neutral" | "empty" | "padding"

export type JournalWeekSummary = {
  weekIndex: number
  label: string
  dateRange: string
  pnl: number
  tradeCount: number
  tradingDays: number
  winRate: number
}

export type DrawdownStats = {
  maxDrawdown: number
  maxDrawdownPercent: number
  currentDrawdown: number
  currentDrawdownPercent: number
  peakEquity: number
  currentEquity: number
  points: { date: string; equity: number; drawdown: number }[]
}

export type SessionPerformanceRow = {
  session: string
  pnl: number
  tradeCount: number
  winRate: number
}

export type WeekdayPerformanceRow = {
  weekday: string
  pnl: number
  tradeCount: number
  winRate: number
}

export function getJournalDayTone(day: HeatmapDay): JournalDayTone {
  if (day.isPadding || !day.inMonth) return "padding"
  if (day.tradeCount === 0) return "empty"
  if (day.pnl > 0) return "win"
  if (day.pnl < 0) return "loss"
  return "neutral"
}

export function formatJournalDayPnl(pnl: number): string {
  if (pnl === 0) return "$0"
  const sign = pnl > 0 ? "+" : "-"
  return `${sign}$${Math.abs(pnl).toFixed(0)}`
}

export function buildJournalMonthStats(
  trades: JournalCalendarTrade[],
  referenceDate = new Date(),
): HeatmapMonthStats {
  return buildPerformanceHeatmap(trades, referenceDate)
}

export function buildWeekSummaries(days: HeatmapDay[]): JournalWeekSummary[] {
  const rows: HeatmapDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7))
  }

  return rows
    .map((row, weekIndex) => {
      const active = row.filter((d) => d.inMonth && !d.isPadding && d.tradeCount > 0)
      if (active.length === 0 && row.every((d) => d.isPadding || !d.inMonth)) {
        return null
      }

      const inMonthDays = row.filter((d) => d.inMonth && !d.isPadding)
      const pnl = inMonthDays.reduce((s, d) => s + d.pnl, 0)
      const tradeCount = inMonthDays.reduce((s, d) => s + d.tradeCount, 0)
      const wins = inMonthDays.reduce((s, d) => s + d.wins, 0)
      const first = inMonthDays.find((d) => d.dayNum > 0)
      const last = [...inMonthDays].reverse().find((d) => d.dayNum > 0)

      return {
        weekIndex: weekIndex + 1,
        label: `Week ${weekIndex + 1}`,
        dateRange:
          first && last ? `${first.dayNum}–${last.dayNum}` : "—",
        pnl,
        tradeCount,
        tradingDays: active.length,
        winRate: tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0,
      }
    })
    .filter((w): w is JournalWeekSummary => w != null)
}

export function buildDrawdownStats(
  trades: JournalCalendarTrade[],
  startingBalance = 10000,
): DrawdownStats {
  const sorted = [...trades].sort(
    (a, b) => getTradeTimestamp(a) - getTradeTimestamp(b),
  )

  let equity = startingBalance
  let peak = startingBalance
  let maxDrawdown = 0
  let maxDrawdownPercent = 0
  const points: DrawdownStats["points"] = []

  for (const trade of sorted) {
    equity += getSignedPnL(trade.pnl, trade.result)
    peak = Math.max(peak, equity)
    const drawdown = peak - equity
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0
    maxDrawdown = Math.max(maxDrawdown, drawdown)
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent)

    const date =
      trade.trade_date?.split("T")[0] ?? trade.created_at.split("T")[0]
    points.push({ date, equity, drawdown })
  }

  const currentDrawdown = peak - equity
  const currentDrawdownPercent = peak > 0 ? (currentDrawdown / peak) * 100 : 0

  return {
    maxDrawdown,
    maxDrawdownPercent,
    currentDrawdown,
    currentDrawdownPercent,
    peakEquity: peak,
    currentEquity: equity,
    points,
  }
}

export function buildSessionPerformance(
  trades: JournalCalendarTrade[],
): SessionPerformanceRow[] {
  const map = new Map<string, { pnl: number; tradeCount: number; wins: number }>()

  for (const trade of trades) {
    const session = trade.session?.trim() || "Unspecified"
    const cur = map.get(session) ?? { pnl: 0, tradeCount: 0, wins: 0 }
    cur.pnl += getSignedPnL(trade.pnl, trade.result)
    cur.tradeCount += 1
    if (trade.result === "WIN") cur.wins += 1
    map.set(session, cur)
  }

  return Array.from(map.entries())
    .map(([session, stats]) => ({
      session,
      pnl: stats.pnl,
      tradeCount: stats.tradeCount,
      winRate:
        stats.tradeCount > 0
          ? Math.round((stats.wins / stats.tradeCount) * 100)
          : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl)
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function buildWeekdayPerformance(
  trades: JournalCalendarTrade[],
): WeekdayPerformanceRow[] {
  const map = new Map<number, { pnl: number; tradeCount: number; wins: number }>()

  for (const trade of trades) {
    const ts = getTradeTimestamp(trade)
    const day = new Date(ts).getDay()
    const cur = map.get(day) ?? { pnl: 0, tradeCount: 0, wins: 0 }
    cur.pnl += getSignedPnL(trade.pnl, trade.result)
    cur.tradeCount += 1
    if (trade.result === "WIN") cur.wins += 1
    map.set(day, cur)
  }

  return WEEKDAY_LABELS.map((weekday, index) => {
    const stats = map.get(index)
    if (!stats) {
      return { weekday, pnl: 0, tradeCount: 0, winRate: 0 }
    }
    return {
      weekday,
      pnl: stats.pnl,
      tradeCount: stats.tradeCount,
      winRate:
        stats.tradeCount > 0
          ? Math.round((stats.wins / stats.tradeCount) * 100)
          : 0,
    }
  }).filter((row) => row.tradeCount > 0)
}

export function filterTradesForMonth<T extends JournalCalendarTrade>(
  trades: T[],
  year: number,
  month: number,
): T[] {
  return trades.filter((trade) => {
    const key = getCalendarDateKey(trade)
    if (!key) return false
    const [y, m] = key.split("-").map(Number)
    return y === year && m - 1 === month
  })
}

export function filterTradesForDate<T extends { trade_date: string | null; created_at: string }>(
  trades: T[],
  dateKey: string,
): T[] {
  return trades.filter((trade) => {
    const key = getCalendarDateKey(trade)
    return key != null && key === dateKey
  })
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}
