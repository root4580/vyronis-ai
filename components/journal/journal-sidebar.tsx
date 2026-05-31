"use client"

import { CalendarDays, Target, TrendingUp } from "lucide-react"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import { formatBestDayPnl, type HeatmapMonthStats } from "@/lib/performance-heatmap"
import type { JournalWeekSummary } from "@/lib/journal/calendar-analytics"
import { cn } from "@/lib/utils"

export function JournalSidebar({
  monthStats,
  weeks,
  className,
}: {
  monthStats: HeatmapMonthStats
  weeks: JournalWeekSummary[]
  className?: string
}) {
  return (
    <aside className={cn("hidden w-full shrink-0 space-y-3 xl:flex xl:w-[300px] xl:flex-col", className)}>
      <DashboardCard interactive glow className="glass-card">
        <DashboardCardHeader title="Monthly stats" icon={CalendarDays} />
        <DashboardCardBody className="grid grid-cols-2 gap-2 pt-1">
          <DashboardInsetPanel className="px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
              Month P&L
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                monthStats.totalPnL >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {monthStats.totalPnL >= 0 ? "+" : "-"}$
              {Math.abs(monthStats.totalPnL).toFixed(0)}
            </p>
          </DashboardInsetPanel>
          <DashboardInsetPanel className="px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
              Green days
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-profit">
              {monthStats.profitableDays}/{monthStats.tradedDays}
            </p>
          </DashboardInsetPanel>
          <DashboardInsetPanel className="px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
              Consistency
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-cyan-glow">
              {monthStats.consistencyScore}%
            </p>
          </DashboardInsetPanel>
          <DashboardInsetPanel className="px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
              Best day
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-semibold tabular-nums",
                monthStats.bestDay ? "text-profit" : "text-muted-foreground/60",
              )}
            >
              {formatBestDayPnl(monthStats.bestDay)}
            </p>
          </DashboardInsetPanel>
        </DashboardCardBody>
      </DashboardCard>

      <DashboardCard interactive className="glass-card">
        <DashboardCardHeader title="Weekly summary" icon={Target} />
        <DashboardCardBody className="space-y-2 pt-1">
          {weeks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">No trading weeks yet</p>
          ) : (
            weeks.map((week) => (
              <DashboardInsetPanel
                key={week.weekIndex}
                className="flex items-center justify-between gap-2 px-3 py-2.5"
              >
                <div>
                  <p className="text-[11px] font-medium text-foreground/90">{week.label}</p>
                  <p className="text-[10px] text-muted-foreground/65">
                    {week.dateRange} · {week.tradingDays}d · {week.tradeCount} trades
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      week.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {week.pnl >= 0 ? "+" : "-"}${Math.abs(week.pnl).toFixed(0)}
                  </p>
                  <p className="text-[10px] tabular-nums text-muted-foreground/60">
                    {week.winRate}% WR
                  </p>
                </div>
              </DashboardInsetPanel>
            ))
          )}
        </DashboardCardBody>
      </DashboardCard>

      <DashboardInsetPanel className="flex items-center gap-2 border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-2.5">
        <TrendingUp className="size-4 shrink-0 text-cyan-glow" />
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          {monthStats.currentStreak.count > 0
            ? `${monthStats.currentStreak.count}-day ${monthStats.currentStreak.type} streak`
            : "Tap a day, then log or review trades — manual journal first"}
        </p>
      </DashboardInsetPanel>
    </aside>
  )
}
