import type { ChapterTradeRow } from "@/lib/weekly-chapters/types"
import { getSignedPnL } from "@/lib/trade-utils"
import { isTradeInWeekStart } from "@/lib/weekly-chapters/week-utils"

function isLoss(trade: ChapterTradeRow): boolean {
  const signed = getSignedPnL(trade.pnl ?? 0, trade.result ?? "")
  return signed < 0 || trade.result?.toUpperCase() === "LOSS"
}

function isWin(trade: ChapterTradeRow): boolean {
  const signed = getSignedPnL(trade.pnl ?? 0, trade.result ?? "")
  return signed > 0 || trade.result?.toUpperCase() === "WIN"
}

function weekTrades(trades: ChapterTradeRow[], weekStart: string): ChapterTradeRow[] {
  return trades.filter((trade) => isTradeInWeekStart(trade, weekStart))
}

export function buildKeyLesson(input: {
  trades: ChapterTradeRow[]
  weekStart: string
  wins: number
  losses: number
  pnl: number
  disciplineScore: number | null
}): string {
  const bucket = weekTrades(input.trades, input.weekStart)
  const revengeTagged = bucket.filter((trade) =>
    (trade.emotion ?? "").toLowerCase().includes("revenge"),
  ).length
  const hadLosses = input.losses > 0

  if (hadLosses && revengeTagged === 0) {
    return "Waited for SL, didn't revenge trade. That's growth."
  }

  if (input.wins > 0 && input.losses === 0) {
    return "Clean chapter — you traded your plan and protected capital."
  }

  if (input.disciplineScore != null && input.disciplineScore >= 85) {
    return "Discipline held under pressure. Process over outcome."
  }

  if (input.pnl > 0) {
    return "Green week — note what you repeated, not just what you made."
  }

  if (input.losses >= 3) {
    return "Tough chapter. The market will offer another setup — protect the next one."
  }

  if (bucket.length === 0) {
    return "No trades logged — patience is also an edge."
  }

  return "Every chapter teaches something. Write one thing you will keep next week."
}

export function countWeekLosses(trades: ChapterTradeRow[], weekStart: string): number {
  return weekTrades(trades, weekStart).filter(isLoss).length
}

export function hasWinInWeek(trades: ChapterTradeRow[], weekStart: string): boolean {
  return weekTrades(trades, weekStart).some(isWin)
}

export function computeWeekTradeStats(
  trades: ChapterTradeRow[],
  weekStart: string,
): { wins: number; losses: number; winRate: number; pnl: number; tradesTaken: number } {
  const bucket = weekTrades(trades, weekStart)
  const wins = bucket.filter(isWin).length
  const losses = bucket.filter(isLoss).length
  const closed = wins + losses
  const pnl = bucket.reduce((sum, trade) => sum + getSignedPnL(trade.pnl ?? 0, trade.result ?? ""), 0)
  return {
    tradesTaken: bucket.length,
    wins,
    losses,
    winRate: closed > 0 ? Math.round((wins / closed) * 100) : 0,
    pnl,
  }
}

export function computeChapterStreak(summaries: Array<{ is_winning_chapter: boolean; week_start: string }>): number {
  const sorted = [...summaries].sort((a, b) => b.week_start.localeCompare(a.week_start))
  let streak = 0
  for (const summary of sorted) {
    if (summary.is_winning_chapter) {
      streak++
      continue
    }
    break
  }
  return streak
}
