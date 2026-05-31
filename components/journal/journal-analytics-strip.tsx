"use client"

import { Activity, Clock, TrendingDown } from "lucide-react"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
} from "@/components/dashboard/dashboard-primitives"
import { JournalHorizontalBarRow } from "@/components/journal/journal-horizontal-bar"
import type {
  DrawdownStats,
  SessionPerformanceRow,
  WeekdayPerformanceRow,
} from "@/lib/journal/calendar-analytics"
import { cn } from "@/lib/utils"

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
  const sessionRows = sessions.slice(0, 5)
  const sessionMax = Math.max(...sessionRows.map((s) => Math.abs(s.pnl)), 1)
  const weekdayMax = Math.max(...weekdays.map((w) => Math.abs(w.pnl)), 1)
  const drawdownMax = Math.max(drawdown.maxDrawdownPercent, drawdown.currentDrawdownPercent, 1)

  return (
    <div className={cn("grid grid-cols-1 gap-3 lg:grid-cols-3", className)}>
      <DashboardCard interactive className="hq-surface-card">
        <DashboardCardHeader title="Drawdown" icon={TrendingDown} />
        <DashboardCardBody className="space-y-2.5 pt-1">
          <JournalHorizontalBarRow
            label="Max"
            value={-drawdown.maxDrawdownPercent}
            maxAbs={drawdownMax}
            formatValue={(v) => `${Math.abs(v).toFixed(1)}%`}
          />
          <JournalHorizontalBarRow
            label="Current"
            value={-drawdown.currentDrawdownPercent}
            maxAbs={drawdownMax}
            formatValue={(v) => `${Math.abs(v).toFixed(1)}%`}
          />
          <p className="pt-1 text-[11px] leading-relaxed text-text-muted">
            Peak ${drawdown.peakEquity.toLocaleString()} · Current $
            {drawdown.currentEquity.toLocaleString()}
          </p>
        </DashboardCardBody>
      </DashboardCard>

      <DashboardCard interactive className="hq-surface-card">
        <DashboardCardHeader title="Session performance" icon={Clock} />
        <DashboardCardBody className="space-y-2.5 pt-1">
          {sessionRows.length === 0 ? (
            <p className="text-[11px] text-text-muted">No session data yet</p>
          ) : (
            sessionRows.map((s) => (
              <JournalHorizontalBarRow
                key={s.session}
                label={s.session.replace(" Session", "").slice(0, 8)}
                value={Math.round(s.pnl)}
                maxAbs={sessionMax}
              />
            ))
          )}
        </DashboardCardBody>
      </DashboardCard>

      <DashboardCard interactive className="hq-surface-card">
        <DashboardCardHeader title="Day-of-week edge" icon={Activity} />
        <DashboardCardBody className="space-y-2.5 pt-1">
          {weekdays.length === 0 ? (
            <p className="text-[11px] text-text-muted">Log trades to see timing</p>
          ) : (
            weekdays.map((w) => (
              <JournalHorizontalBarRow
                key={w.weekday}
                label={w.weekday.slice(0, 3)}
                value={Math.round(w.pnl)}
                maxAbs={weekdayMax}
              />
            ))
          )}
        </DashboardCardBody>
      </DashboardCard>
    </div>
  )
}
