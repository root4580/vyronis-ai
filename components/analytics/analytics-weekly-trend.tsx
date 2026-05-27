"use client"

import { TrendingUp } from "lucide-react"
import {
  Bar,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import type { WeeklyTrendPoint } from "@/lib/analytics/types"

type AnalyticsWeeklyTrendProps = {
  data: WeeklyTrendPoint[]
}

export function AnalyticsWeeklyTrend({ data }: AnalyticsWeeklyTrendProps) {
  const hasData = data.length > 0

  return (
    <DashboardCard
      className="glass-card floating-glow analytics-fade-in opacity-0"
      style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
      inset
      interactive
      glow
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-profit/[0.05] to-transparent" />
      <DashboardCardHeader title="Weekly Performance Trend" icon={TrendingUp} />
      <DashboardCardBody className="h-[300px] md:h-[340px]">
        {!hasData ? (
          <DashboardEmptyState
            icon={TrendingUp}
            title="No weekly trend data"
            description="Trade across multiple weeks to unlock performance trends"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="week" {...CHART_AXIS} tick={{ fill: "rgba(255,255,255,0.35)" }} />
              <YAxis
                yAxisId="pnl"
                {...CHART_AXIS}
                width={48}
                tick={{ fill: "rgba(255,255,255,0.35)" }}
                tickFormatter={(v) => `$${v}`}
              />
              <YAxis
                yAxisId="rate"
                orientation="right"
                {...CHART_AXIS}
                width={36}
                tick={{ fill: "rgba(255,255,255,0.28)" }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontSize: 11 }}
                formatter={(value: number, name: string) => {
                  if (name === "winRate") return [`${value}%`, "Win Rate"]
                  if (name === "pnl") return [`$${value.toFixed(2)}`, "P&L"]
                  return [value, name]
                }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar yAxisId="pnl" dataKey="pnl" radius={[6, 6, 0, 0]} barSize={24} isAnimationActive animationDuration={1000}>
                {data.map((entry, index) => (
                  <Cell
                    key={`week-${index}`}
                    fill={entry.pnl >= 0 ? "oklch(0.7 0.18 155)" : "oklch(0.55 0.2 25)"}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="winRate"
                stroke="oklch(0.72 0.14 195)"
                strokeWidth={2}
                dot={{ r: 3, fill: "oklch(0.72 0.14 195)", strokeWidth: 0 }}
                isAnimationActive
                animationDuration={1200}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
