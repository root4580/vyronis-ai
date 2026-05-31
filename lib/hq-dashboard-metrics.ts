import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { getSignedPnL } from "@/lib/trade-utils"

export function getWeekTradeBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + diff)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

export function isTradeInWeek(trade: DashboardTradeRow, now = new Date()): boolean {
  const raw = trade.trade_date || trade.created_at?.split("T")[0]
  if (!raw) return false
  const date = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(date.getTime())) return false
  const { start, end } = getWeekTradeBounds(now)
  return date >= start && date < end
}

export function computeWeekPnL(trades: DashboardTradeRow[], now = new Date()): number {
  return trades
    .filter((t) => isTradeInWeek(t, now))
    .reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
}

export function computeAvgRiskReward(trades: DashboardTradeRow[]): {
  average: number | null
  plannedAverage: number | null
} {
  const withRr = trades.filter((t) => t.risk_reward != null && Number.isFinite(t.risk_reward))
  const average =
    withRr.length > 0
      ? withRr.reduce((sum, t) => sum + (t.risk_reward ?? 0), 0) / withRr.length
      : null
  const planned = trades.filter((t) => t.setup?.includes("[vyronis-planned-setup]"))
  const plannedWithRr = planned.filter((t) => t.risk_reward != null && Number.isFinite(t.risk_reward))
  const plannedAverage =
    plannedWithRr.length > 0
      ? plannedWithRr.reduce((sum, t) => sum + (t.risk_reward ?? 0), 0) / plannedWithRr.length
      : null
  return { average, plannedAverage }
}

export function hasLossStreak(trades: DashboardTradeRow[], count = 3): boolean {
  const sorted = [...trades].sort((a, b) => {
    const da = a.trade_date ?? a.created_at ?? ""
    const db = b.trade_date ?? b.created_at ?? ""
    return db.localeCompare(da)
  })
  if (sorted.length < count) return false
  return sorted.slice(0, count).every((t) => {
    const pnl = getSignedPnL(t.pnl, t.result)
    return t.result?.toLowerCase() === "loss" || pnl < 0
  })
}

export function getTimeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatHeaderDate(now = new Date()): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}
