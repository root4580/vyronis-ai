"use client"

import type { HeatmapMonthStats } from "@/lib/performance-heatmap"
import { formatJournalDayPnl } from "@/lib/journal/calendar-analytics"
import { cn } from "@/lib/utils"

export function JournalMonthStrip({ stats }: { stats: HeatmapMonthStats }) {
  const pnlPositive = stats.totalPnL >= 0

  return (
    <div className="vyronis-month-strip flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2.5 sm:px-4">
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/55">
          This month
        </p>
        <p
          className={cn(
            "text-[20px] font-bold tabular-nums tracking-tight sm:text-[22px]",
            pnlPositive ? "text-profit" : "text-loss",
          )}
        >
          {formatJournalDayPnl(stats.totalPnL)}
        </p>
      </div>
      <div className="flex gap-4 text-[11px] text-muted-foreground/75">
        <span>
          <span className="font-semibold text-foreground/90">{stats.tradedDays}</span> active days
        </span>
        <span>
          <span className="font-semibold text-profit/90">{stats.profitableDays}</span> green
        </span>
        <span>
          <span className="font-semibold text-loss/90">{stats.losingDays}</span> red
        </span>
      </div>
    </div>
  )
}
