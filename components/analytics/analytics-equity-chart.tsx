"use client"

import { Activity } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import type { EquityCurvePoint } from "@/lib/analytics/types"

type AnalyticsEquityChartProps = {
  data: EquityCurvePoint[]
  startingBalance: number
}

export function AnalyticsEquityChart({ data, startingBalance }: AnalyticsEquityChartProps) {
  const hasData = data.length > 1
  const endEquity = data[data.length - 1]?.equity ?? startingBalance
  const totalPnL = endEquity - startingBalance
  const roiPercent = startingBalance > 0 ? ((totalPnL / startingBalance) * 100).toFixed(1) : "0"

  return (
    <DashboardCard className="hq-surface-card analytics-fade-in opacity-0 col-span-1 lg:col-span-2" style={{ animationDelay: "320ms", animationFillMode: "forwards" }} inset interactive>
      <DashboardCardHeader
        title="Equity Curve"
        icon={Activity}
        badge={
          hasData ? (
            <Badge
              variant="outline"
              className={`h-6 text-[10px] font-medium live-pulse ${
                totalPnL >= 0
                  ? "border-profit/25 text-profit bg-profit/[0.08]"
                  : "border-loss/25 text-loss bg-loss/[0.08]"
              }`}
            >
              {totalPnL >= 0 ? "+" : ""}
              {roiPercent}% ROI
            </Badge>
          ) : undefined
        }
      />
      <DashboardCardBody className="h-[300px] md:h-[340px]">
        {!hasData ? (
          <DashboardEmptyState
            icon={Activity}
            title="No equity data yet"
            description="Log trades to visualize your account growth curve"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsEquityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="date" {...CHART_AXIS} tick={{ fill: "rgba(255,255,255,0.35)" }} />
              <YAxis
                {...CHART_AXIS}
                width={56}
                tick={{ fill: "rgba(255,255,255,0.35)" }}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontSize: 11 }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Equity"]}
                cursor={{ stroke: "rgb(from var(--color-accent) r g b / 0.3)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#analyticsEquityGradient)"
                isAnimationActive
                animationDuration={1400}
                animationEasing="ease-out"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "var(--color-accent)",
                  stroke: "rgba(255,255,255,0.9)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
