"use client"

import { Layers } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import {
  CHART_TOOLTIP_STYLE,
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import type { SetupBreakdownItem } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

type AnalyticsSetupBreakdownProps = {
  data: SetupBreakdownItem[]
}

const BUCKET_BADGE: Record<string, string> = {
  "A+": "border-cyan-glow/35 bg-cyan-glow/[0.12] text-cyan-glow",
  A: "border-profit/30 bg-profit/[0.1] text-profit",
  B: "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-300",
  C: "border-amber-500/30 bg-amber-500/[0.1] text-amber-300",
}

export function AnalyticsSetupBreakdown({ data }: AnalyticsSetupBreakdownProps) {
  const hasData = data.some((item) => item.count > 0)
  const chartData = data.filter((item) => item.count > 0)

  return (
    <DashboardCard
      className="glass-card floating-glow analytics-fade-in opacity-0"
      style={{ animationDelay: "480ms", animationFillMode: "forwards" }}
      inset
      interactive
      glow
    >
      <DashboardCardHeader title="Setup Classification" icon={Layers} />
      <DashboardCardBody className="h-[280px]">
        {!hasData ? (
          <DashboardEmptyState
            icon={Layers}
            title="No setup data"
            description="Save trades to see A+, A, B, and C breakdowns"
          />
        ) : (
          <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-[180px] flex-1 sm:h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="count"
                    nameKey="bucket"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    isAnimationActive
                    animationDuration={1100}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.bucket} fill={entry.color} stroke="rgba(0,0,0,0.2)" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number, _name, props) => [
                      `${value} trades (${props.payload.percentage}%)`,
                      props.payload.bucket,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-1">
              {data.map((item) => (
                <div
                  key={item.bucket}
                  className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full border px-2 text-[10px] font-bold",
                        BUCKET_BADGE[item.bucket],
                      )}
                    >
                      {item.bucket}
                    </span>
                    <span className="text-sm font-bold tabular-nums">{item.count}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">{item.percentage}% of journal</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
