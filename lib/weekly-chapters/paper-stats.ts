import { computePaperTradeStats } from "@/lib/paper-trades/stats"
import type { PaperTradeRecord } from "@/lib/paper-trades/types"
import type { WeeklyChapterPaperStats } from "@/lib/weekly-chapters/types"
import { isTradeInWeekStart } from "@/lib/weekly-chapters/week-utils"

export function filterPaperTradesForWeek(
  trades: PaperTradeRecord[],
  weekStart: string,
): PaperTradeRecord[] {
  return trades.filter((trade) =>
    isTradeInWeekStart(
      {
        trade_date: trade.entry_at?.slice(0, 10) ?? trade.created_at.slice(0, 10),
        created_at: trade.created_at,
      },
      weekStart,
    ),
  )
}

export function computeWeeklyChapterPaperStats(
  trades: PaperTradeRecord[],
  weekStart: string,
): WeeklyChapterPaperStats {
  const weekTrades = filterPaperTradesForWeek(trades, weekStart)
  const stats = computePaperTradeStats(weekTrades)
  const closed = stats.wins + stats.losses

  return {
    total: stats.total,
    closed,
    pending: stats.pending,
    wins: stats.wins,
    losses: stats.losses,
    winRate: stats.winRate,
    totalPnL: stats.totalPnL,
    winStreak: stats.winStreak,
    readyForLive: stats.readyForLive,
    coachGraded: weekTrades.filter((trade) => Boolean(trade.setup_grade?.trim())).length,
    warRoomCount: weekTrades.filter((trade) => trade.source === "war_room").length,
  }
}

export function parseWeeklyChapterPaperStats(value: unknown): WeeklyChapterPaperStats | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const total = Number(row.total ?? 0)
  if (!Number.isFinite(total)) return null

  return {
    total,
    closed: Number(row.closed ?? 0),
    pending: Number(row.pending ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    winRate: Number(row.winRate ?? 0),
    totalPnL: Number(row.totalPnL ?? 0),
    winStreak: Number(row.winStreak ?? 0),
    readyForLive: Boolean(row.readyForLive),
    coachGraded: Number(row.coachGraded ?? 0),
    warRoomCount: Number(row.warRoomCount ?? 0),
  }
}

export function readWeeklySummaryPaperStats(
  summary: { summary_payload?: Record<string, unknown> },
): WeeklyChapterPaperStats | null {
  return parseWeeklyChapterPaperStats(summary.summary_payload?.paper)
}

export function formatWeeklyPaperSummaryLine(stats: WeeklyChapterPaperStats | null): string | null {
  if (!stats || stats.total === 0) return null

  const parts: string[] = [
    `${stats.total} paper trade${stats.total === 1 ? "" : "s"}`,
  ]

  if (stats.closed > 0) {
    parts.push(`${stats.winRate}% win`)
  } else if (stats.pending > 0) {
    parts.push(`${stats.pending} open`)
  }

  if (stats.winStreak > 0 && !stats.readyForLive) {
    parts.push(`${stats.winStreak}/3 graduation streak`)
  }

  if (stats.readyForLive) {
    parts.push("setup proven — ready for live")
  }

  return parts.join(" · ")
}

export function buildWeeklyPaperNarrativeLine(stats: WeeklyChapterPaperStats | null): string | null {
  if (!stats || stats.total === 0) return null

  if (stats.readyForLive) {
    return `Practice Room: ${stats.closed} closed paper trades with a ${stats.winStreak}-win streak — your setup is proven. Consider going live when rules allow.`
  }

  if (stats.closed > 0) {
    return `Practice Room: ${stats.total} paper trade${stats.total === 1 ? "" : "s"} (${stats.winRate}% win on ${stats.closed} closed) — learning without live P&L.`
  }

  return `Practice Room: ${stats.total} paper trade${stats.total === 1 ? "" : "s"} still open — finish them to build your graduation streak.`
}
