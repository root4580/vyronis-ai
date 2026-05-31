"use client"

import { useMemo, useState } from "react"
import { Calendar, Flame, Sparkles, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import {
  buildPerformanceHeatmap,
  formatBestDayPnl,
  formatHeatmapTooltip,
  getHeatmapIntensityClass,
  type HeatmapDay,
  type HeatmapTrade,
} from "@/lib/performance-heatmap"

type PerformanceHeatmapProps = {
  trades?: HeatmapTrade[]
}

export function PerformanceHeatmap({ trades }: PerformanceHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null)

  const heatmap = useMemo(
    () => buildPerformanceHeatmap(trades ?? []),
    [trades],
  )

  const maxAbsPnl = useMemo(() => {
    const values = heatmap.days
      .filter((day) => day.tradeCount > 0)
      .map((day) => Math.abs(day.pnl))
    return values.length > 0 ? Math.max(...values) : 1
  }, [heatmap.days])

  const weekDays = ["S", "M", "T", "W", "T", "F", "S"]
  const hasTrades = (trades?.length ?? 0) > 0
  const isSparseMonth = hasTrades && heatmap.tradedDays > 0 && heatmap.tradedDays < 5

  return (
    <DashboardCard interactive glow className="overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-profit/[0.04] via-transparent to-cyan-glow/[0.04]" />
      <DashboardCardHeader
        title="Performance Heatmap"
        icon={Calendar}
        badge={
          <Badge
            variant="outline"
            className="h-5 border-white/10 bg-white/[0.03] text-[9px] font-medium text-muted-foreground"
          >
            {heatmap.monthLabel}
          </Badge>
        }
      />
      <DashboardCardBody className="relative space-y-3">
        {!hasTrades ? (
          <DashboardEmptyState
            icon={Calendar}
            title="No performance data yet"
            description="Log trades to populate your monthly heatmap"
            className="min-h-[180px]"
          />
        ) : (
          <>
            {isSparseMonth ? (
              <DashboardInsetPanel className="border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground/80">
                  {heatmap.tradedDays} trading day{heatmap.tradedDays === 1 ? "" : "s"} logged this month.
                  Most cells stay empty until you journal more consistently.
                </p>
              </DashboardInsetPanel>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <DashboardInsetPanel className="px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Consistency
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-cyan-glow">
                  {heatmap.consistencyScore}%
                </p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Month P&L
                </p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums ${
                    heatmap.totalPnL >= 0 ? "text-profit" : "text-loss"
                  }`}
                >
                  {heatmap.totalPnL >= 0 ? "+" : "-"}$
                  {Math.abs(heatmap.totalPnL).toFixed(0)}
                </p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Best Day
                </p>
                <p
                  className={`mt-1 truncate text-sm font-semibold tabular-nums ${
                    heatmap.bestDay ? "text-profit" : "text-muted-foreground/60"
                  }`}
                >
                  {formatBestDayPnl(heatmap.bestDay)}
                </p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Streak
                </p>
                <p className="mt-1 flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
                  {heatmap.currentStreak.count > 0 ? (
                    <>
                      <Flame className="size-3.5 text-amber-400" />
                      {heatmap.currentStreak.count}d{" "}
                      {heatmap.currentStreak.type === "profit" ? "green" : "red"}
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </DashboardInsetPanel>
            </div>

            <div className="relative overflow-x-auto">
              <div className="min-w-[260px] space-y-2">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day, index) => (
                    <div
                      key={`${day}-${index}`}
                      className="text-center text-[10px] font-medium text-muted-foreground/60"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {heatmap.days.map((day, index) => (
                    <div
                      key={`${day.date || "pad"}-${index}`}
                      className={
                        day.isPadding
                          ? "aspect-square"
                          : `heatmap-cell aspect-square cursor-pointer rounded-[5px] border transition-all duration-200 ${
                              day.isToday ? "ring-1 ring-cyan-glow/70 ring-offset-1 ring-offset-background" : ""
                            } ${getHeatmapIntensityClass(day, maxAbsPnl)}`
                      }
                      onMouseEnter={() => !day.isPadding && setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      title={formatHeatmapTooltip(day)}
                      aria-label={formatHeatmapTooltip(day).replace("\n", ", ")}
                    />
                  ))}
                </div>
              </div>
            </div>

            {hoveredDay && hoveredDay.inMonth && (
              <DashboardInsetPanel className="border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-2.5 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-foreground">{hoveredDay.date}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {hoveredDay.tradeCount === 0
                        ? "No trades logged"
                        : `${hoveredDay.tradeCount} trade${hoveredDay.tradeCount > 1 ? "s" : ""} · ${hoveredDay.winRate}% win rate`}
                    </p>
                  </div>
                  <div className="text-right">
                    {hoveredDay.tradeCount > 0 ? (
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          hoveredDay.pnl >= 0 ? "text-profit" : "text-loss"
                        }`}
                      >
                        {hoveredDay.pnl >= 0 ? "+" : "-"}$
                        {Math.abs(hoveredDay.pnl).toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/60">—</p>
                    )}
                  </div>
                </div>
              </DashboardInsetPanel>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-muted-foreground/70">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="size-3 text-profit" />
                <span>{heatmap.profitableDays} green days</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Loss</span>
                <div className="size-2.5 rounded-[3px] bg-loss/60" />
                <div className="size-2.5 rounded-[3px] bg-white/[0.04]" />
                <div className="size-2.5 rounded-[3px] bg-profit/60" />
                <span>Profit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-cyan-glow" />
                <span>{heatmap.longestProfitStreak}d best streak</span>
              </div>
            </div>
          </>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
