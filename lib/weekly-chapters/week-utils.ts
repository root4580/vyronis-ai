import {
  getTradingWeekBounds,
  getTradingWeekBoundsFromStartKey,
  getTradingWeekStartKey,
  isTradeInTradingWeek,
  isTradingWeekStartSunday,
} from "@/lib/trading/trading-week"

export function toWeekStartISO(date: Date): string {
  return getTradingWeekStartKey(date, 0)
}

export function parseWeekStart(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

export function getPreviousWeekStartISO(weekStart: string): string {
  const { start } = getTradingWeekBoundsFromStartKey(weekStart)
  return getTradingWeekBounds(start, -1).weekStartKey
}

export function getNextWeekStartISO(weekStart: string): string {
  const { start } = getTradingWeekBoundsFromStartKey(weekStart)
  return getTradingWeekBounds(start, 1).weekStartKey
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

export { isTradingWeekStartSunday } from "@/lib/trading/trading-week"

export function computeChapterNumber(originWeekStart: string, weekStart: string): number {
  if (weekStart <= originWeekStart) return 1

  let chapter = 1
  let cursor = originWeekStart
  while (cursor < weekStart) {
    cursor = getNextWeekStartISO(cursor)
    chapter += 1
    if (chapter > 520) break
  }
  return chapter
}

/** First trading week for this account — not calendar age since signup. */
export function resolveOriginWeekStart(
  trades: Array<{ trade_date: string | null; created_at: string | null }>,
  options?: {
    summaries?: Array<{ week_start: string }>
    referenceDate?: Date
  },
): string {
  let earliest: string | null = null

  for (const trade of trades) {
    const raw = trade.trade_date || trade.created_at?.split("T")[0]
    if (!raw) continue
    const week = toWeekStartISO(parseWeekStart(raw))
    if (!earliest || week < earliest) earliest = week
  }

  for (const summary of options?.summaries ?? []) {
    const week = summary.week_start.slice(0, 10)
    if (!earliest || week < earliest) earliest = week
  }

  if (earliest) return earliest

  return toWeekStartISO(options?.referenceDate ?? new Date())
}

export function disciplineGradeFromScore(score: number | null): string | null {
  if (score == null) return null
  if (score >= 90) return "A+"
  if (score >= 85) return "A"
  if (score >= 75) return "B"
  if (score >= 65) return "C"
  return "D"
}
