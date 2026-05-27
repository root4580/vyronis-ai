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
    <DashboardCard className="glass-card floating-glow analytics-fade-in opacity-0 col-span-1 lg:col-span-2" style={{ animationDelay: "320ms", animationFillMode: "forwards" }} inset interactive glow>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-glow/[0.08] to-transparent" />
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
                  <stop offset="0%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0.5} />
                  <stop offset="55%" stopColor="oklch(0.68 0.16 165)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="analyticsEquityStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.65 0.12 195)" />
                  <stop offset="100%" stopColor="oklch(0.75 0.16 195)" />
                </linearGradient>
                <filter id="analyticsEquityGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
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
                cursor={{ stroke: "rgba(34, 211, 238, 0.3)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="url(#analyticsEquityStroke)"
                strokeWidth={2.5}
                fill="url(#analyticsEquityGradient)"
                filter="url(#analyticsEquityGlow)"
                isAnimationActive
                animationDuration={1400}
                animationEasing="ease-out"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "oklch(0.72 0.14 195)",
                  stroke: "rgba(255,255,255,0.95)",
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
