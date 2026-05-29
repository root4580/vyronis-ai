"use client"

import { Radio } from "lucide-react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { SetupGradeBadge } from "@/components/command-center/setup-grade-badge"
import { setupVerdictLabel } from "@/lib/tradingview/signal-war-room-grader"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { SetupGrade } from "@/lib/strategy-brain/types"

type TradingViewAlertCoachSummaryProps = {
  plannedContext: PreTradePlannedContext
  compact?: boolean
}

export function TradingViewAlertCoachSummary({
  plannedContext,
  compact = false,
}: TradingViewAlertCoachSummaryProps) {
  if (plannedContext.signal_source !== "tradingview") return null

  const gradeInsight = plannedContext.coach_analysis?.insights?.find((line) =>
    line.startsWith("War Room grade:"),
  )
  const grade =
    plannedContext.tradingview_setup_grade ??
    (gradeInsight?.match(/grade:\s*([A-D][+]?)/i)?.[1] as SetupGrade | undefined)
  const verdict = plannedContext.tradingview_setup_verdict
  const chartVision = plannedContext.tradingview_chart_vision
  const visionScore =
    chartVision?.vision_score ?? plannedContext.vision_score ?? null

  return (
    <DashboardInsetPanel
      className={
        compact
          ? "border-cyan-glow/20 bg-cyan-glow/[0.05] px-3 py-2.5"
          : "border-cyan-glow/25 bg-cyan-glow/[0.06] px-3 py-3"
      }
    >
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-glow/90">
        <Radio className="size-3.5" />
        TradingView setup alert
      </p>
      <p className="mt-1.5 text-[12px] font-medium text-foreground/92">
        {plannedContext.pair} {plannedContext.direction}
        {plannedContext.strategy_name ? ` · ${plannedContext.strategy_name}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {grade ? <SetupGradeBadge grade={grade as SetupGrade} /> : null}
        {verdict ? (
          <span className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground/85">
            {setupVerdictLabel(verdict)}
          </span>
        ) : null}
        {visionScore != null ? (
          <span className="rounded-md border border-cyan-glow/20 bg-cyan-glow/[0.08] px-2 py-0.5 text-[10px] tabular-nums text-cyan-glow">
            Vision {Math.round(visionScore)}/100
          </span>
        ) : null}
      </div>
      {plannedContext.tradingview_verdict_summary ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/75">
          {plannedContext.tradingview_verdict_summary}
        </p>
      ) : null}
      {chartVision?.summary ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
          Chart: {chartVision.summary}
        </p>
      ) : null}
    </DashboardInsetPanel>
  )
}
