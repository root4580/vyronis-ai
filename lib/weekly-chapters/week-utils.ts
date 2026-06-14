import { getWeekTradeBounds } from "@/lib/hq-dashboard-metrics"
import {
  getTradingWeekBoundsFromStartKey,
  getTradingWeekStartKey,
  isTradeInTradingWeek,
} from "@/lib/trading/trading-week"

export function toWeekStartISO(date: Date): string {
  const { start } = getWeekTradeBounds(date)
  return start.toISOString().slice(0, 10)
}

export function parseWeekStart(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

export function getPreviousWeekStartISO(weekStart: string): string {
  const date = parseWeekStart(weekStart)
  date.setDate(date.getDate() - 7)
  return date.toISOString().slice(0, 10)
}

export function formatWeekOfLabel(weekStart: string): string {
  const date = parseWeekStart(weekStart)
  return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

export function formatChapterTitle(chapterNumber: number, weekStart: string): string {
  return `Chapter ${chapterNumber} · ${formatWeekOfLabel(weekStart)}`
}

export function isTradeInWeekStart(
  trade: { trade_date: string | null; created_at: string | null },
  weekStart: string,
): boolean {
  const { start, end } = getTradingWeekBoundsFromStartKey(weekStart)
  return isTradeInTradingWeek(trade, start, end)
}

export function isMondayMorning(now = new Date()): boolean {
  return now.getDay() === 1 && now.getHours() < 12
}

export function isSundayEvening(now = new Date()): boolean {
  const { start } = getTradingWeekBoundsFromStartKey(getTradingWeekStartKey(now))
  const msUntilOpen = start.getTime() - now.getTime()
  return msUntilOpen > 0 && msUntilOpen <= 6 * 60 * 60 * 1000
}

export function computeChapterNumber(originWeekStart: string, weekStart: string): number {
  const origin = parseWeekStart(originWeekStart).getTime()
  const current = parseWeekStart(weekStart).getTime()
  const weeks = Math.round((current - origin) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, weeks + 1)
}

export function resolveOriginWeekStart(
  trades: Array<{ trade_date: string | null; created_at: string | null }>,
  accountCreatedAt?: string | null,
): string {
  let earliest: string | null = null
  for (const trade of trades) {
    const raw = trade.trade_date || trade.created_at?.split("T")[0]
    if (!raw) continue
    if (!earliest || raw < earliest) earliest = raw
  }
  if (earliest) return toWeekStartISO(parseWeekStart(earliest))
  if (accountCreatedAt) return toWeekStartISO(new Date(accountCreatedAt))
  return toWeekStartISO(new Date())
}

export function disciplineGradeFromScore(score: number | null): string | null {
  if (score == null) return null
  if (score >= 90) return "A+"
  if (score >= 85) return "A"
  if (score >= 75) return "B"
  if (score >= 65) return "C"
  return "D"
}
