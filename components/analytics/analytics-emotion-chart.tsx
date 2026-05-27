"use client"

import { Heart } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import type { EmotionFrequencyItem } from "@/lib/analytics/types"

type AnalyticsEmotionChartProps = {
  data: EmotionFrequencyItem[]
}

const EMOTION_COLORS: Record<string, string> = {
  Calm: "oklch(0.72 0.14 195)",
  Confident: "oklch(0.7 0.18 155)",
  Disciplined: "oklch(0.68 0.16 165)",
  Anxious: "oklch(0.75 0.14 75)",
  FOMO: "oklch(0.72 0.18 45)",
  Revenge: "oklch(0.55 0.2 25)",
  Euphoric: "oklch(0.7 0.16 300)",
  Fearful: "oklch(0.6 0.12 260)",
}

function emotionColor(emotion: string): string {
  return EMOTION_COLORS[emotion] ?? "oklch(0.55 0.08 240)"
}

export function AnalyticsEmotionChart({ data }: AnalyticsEmotionChartProps) {
  const hasData = data.length > 0
  const chartData = data.slice(0, 8)

  return (
    <DashboardCard
      className="glass-card floating-glow analytics-fade-in opacity-0"
      style={{ animationDelay: "560ms", animationFillMode: "forwards" }}
      inset
      interactive
      glow
    >
      <DashboardCardHeader title="Emotional State Frequency" icon={Heart} />
      <DashboardCardBody className="h-[280px]">
        {!hasData ? (
          <DashboardEmptyState
            icon={Heart}
            title="No emotion data"
            description="Log pre-trade emotions to analyze psychological patterns"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }} barSize={14}>
              <CartesianGrid {...CHART_GRID} horizontal={false} />
              <XAxis type="number" {...CHART_AXIS} tick={{ fill: "rgba(255,255,255,0.3)" }} />
              <YAxis
                type="category"
                dataKey="emotion"
                {...CHART_AXIS}
                width={72}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value: number, _name, props) => [
                  `${value} trades (${props.payload.percentage}%)`,
                  "Frequency",
                ]}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900}>
                {chartData.map((entry) => (
                  <Cell key={entry.emotion} fill={emotionColor(entry.emotion)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
