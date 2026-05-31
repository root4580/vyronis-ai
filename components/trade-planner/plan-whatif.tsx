"use client"

import { GitCompareArrows } from "lucide-react"
import { DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard/dashboard-primitives"
import { Badge } from "@/components/ui/badge"
import { computePlanWhatIf, type PlanWhatIfResult } from "@/lib/trade-planner/plan-whatif-engine"
import type { PlanDisciplineResult } from "@/lib/trade-planner/deviation-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type PlanWhatIfProps = {
  plan: MatchableTradePlan
  trade: {
    result: string
    pnl: number
    direction: string
    entryPrice: number | null
    stopLoss: number | null
    takeProfit: number | null
  }
  discipline: PlanDisciplineResult
  className?: string
}

function gradeBadgeClass(grade: PlanDisciplineResult["grade"]): string {
  switch (grade) {
    case "A":
      return "border-profit/30 bg-profit/[0.12] text-profit"
    case "B":
      return "border-cyan-glow/30 bg-cyan-glow/[0.1] text-cyan-glow"
    case "C":
      return "border-warning/30 bg-warning/[0.1] text-warning-muted"
    default:
      return "border-loss/30 bg-loss/[0.1] text-loss"
  }
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/65">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", valueClassName)}>{value}</p>
    </div>
  )
}

export function PlanWhatIfPanel({ plan, trade, discipline, className }: PlanWhatIfProps) {
  const whatIf: PlanWhatIfResult = computePlanWhatIf({ plan, trade, discipline })

  return (
    <DashboardCard interactive className={cn("glass-card", className)}>
      <DashboardCardHeader title="What if you followed the plan?" icon={GitCompareArrows} />
      <DashboardCardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium text-foreground/90">{whatIf.headline}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">{whatIf.detail}</p>
          </div>
          <Badge className={cn("text-[11px] tabular-nums", gradeBadgeClass(discipline.grade))}>
            {discipline.grade} · {discipline.score}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric
            label="Actual"
            value={formatPnL(whatIf.actualPnl, trade.result)}
            valueClassName={getPnLTextClass(whatIf.actualPnl, trade.result)}
          />
          <Metric
            label="Plan-sized"
            value={
              whatIf.followPlanPnl != null
                ? formatPnL(
                    whatIf.followPlanPnl,
                    trade.result === "LOSS" ? "LOSS" : trade.result === "WIN" ? "WIN" : "BREAKEVEN",
                  )
                : "—"
            }
            valueClassName="text-cyan-glow"
          />
          <Metric
            label="Difference"
            value={
              whatIf.pnlDelta != null
                ? `${whatIf.pnlDelta >= 0 ? "+" : ""}$${whatIf.pnlDelta.toFixed(2)}`
                : "—"
            }
            valueClassName={
              whatIf.pnlDelta == null
                ? "text-muted-foreground"
                : whatIf.pnlDelta >= 0
                  ? "text-profit"
                  : "text-loss"
            }
          />
        </div>
      </DashboardCardBody>
    </DashboardCard>
  )
}
