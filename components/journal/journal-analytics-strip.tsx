"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity, Clock, TrendingDown } from "lucide-react"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
} from "@/components/dashboard/dashboard-primitives"
import type {
  DrawdownStats,
  SessionPerformanceRow,
  WeekdayPerformanceRow,
} from "@/lib/journal/calendar-analytics"
import { cn } from "@/lib/utils"

function MiniStat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground/65">
        {label}
      </p>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", valueClass)}>{value}</p>
    </div>
  )
}

export function JournalAnalyticsStrip({
  drawdown,
  sessions,
  weekdays,
  className,
}: {
  drawdown: DrawdownStats
  sessions: SessionPerformanceRow[]
  weekdays: WeekdayPerformanceRow[]
  className?: string
}) {
  const sessionChart = sessions.slice(0, 5).map((s) => ({
    name: s.session.replace(" Session", "").slice(0, 8),
    pnl: Math.round(s.pnl),
    fill: s.pnl >= 0 ? "oklch(0.7 0.18 155)" : "oklch(0.55 0.2 25)",
  }))

  const weekdayChart = weekdays.map((w) => ({
    name: w.weekday,
    pnl: Math.round(w.pnl),
    fill: w.pnl >= 0 ? "oklch(0.72 0.14 195)" : "oklch(0.55 0.2 25)",
  }))

  return (
    <div className={cn("grid grid-cols-1 gap-3 lg:grid-cols-3", className)}>
      <DashboardCard interactive className="hq-surface-card">
        <DashboardCardHeader title="Drawdown" icon={TrendingDown} />
        <DashboardCardBody className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <MiniStat
              label="Max drawdown"
              value={`-${drawdown.maxDrawdownPercent.toFixed(1)}%`}
              valueClass="text-loss"
            />
            <MiniStat
              label="Current"
              value={`-${drawdown.currentDrawdownPercent.toFixed(1)}%`}
              valueClass={
                drawdown.currentDrawdownPercent > 0 ? "text-warning-foreground" : "text-profit"
              }
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground/75">
            Peak equity ${drawdown.peakEquity.toLocaleString()} · Current $
            {drawdown.currentEquity.toLocaleString()}
          </p>
        </DashboardCardBody>
      </DashboardCard>

      <DashboardCard interactive className="hq-surface-card">
        <DashboardCardHeader title="Session performance" icon={Clock} />
        <DashboardCardBody className="h-[140px] pt-1">
          {sessionChart.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">No session data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionChart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="name" {...CHART_AXIS} interval={0} tick={{ fontSize: 10 }} />
                <YAxis {...CHART_AXIS} tickFormatter={(v) => `$${v}`} width={42} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number) => [`$${value}`, "P&L"]}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardCardBody>
      </DashboardCard>

      <DashboardCard interactive className="hq-surface-card">
        <DashboardCardHeader title="Day-of-week edge" icon={Activity} />
        <DashboardCardBody className="h-[140px] pt-1">
          {weekdayChart.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">Log trades to see timing</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayChart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="name" {...CHART_AXIS} />
                <YAxis {...CHART_AXIS} tickFormatter={(v) => `$${v}`} width={42} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number) => [`$${value}`, "P&L"]}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardCardBody>
      </DashboardCard>
    </div>
  )
}
