"use client"

import Link from "next/link"
import { ArrowRight, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import {
  disciplineGradeLabel,
  type FieldDeviation,
  type PlanDisciplineResult,
} from "@/lib/trade-planner/deviation-engine"
import { cn } from "@/lib/utils"

type PlanDeviationSummaryProps = {
  pairLabel: string
  result: PlanDisciplineResult
  tradeDetailHref?: string
  className?: string
}

function severityClass(severity: FieldDeviation["severity"]): string {
  switch (severity) {
    case "green":
      return "text-profit"
    case "amber":
      return "text-warning-foreground"
    case "red":
      return "text-loss"
    default:
      return "text-muted-foreground/70"
  }
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

export function PlanDeviationSummary({
  pairLabel,
  result,
  tradeDetailHref,
  className,
}: PlanDeviationSummaryProps) {
  const highlights =
    result.worstDeviations.length > 0
      ? result.worstDeviations
      : result.fields.filter((field) => field.severity === "green").slice(0, 2)

  return (
    <DashboardInsetPanel
      className={cn("border-cyan-glow/20 bg-cyan-glow/[0.04] px-4 py-3", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 size-4 text-cyan-glow" />
          <div>
            <p className="text-[12px] font-medium text-foreground/90">Plan vs actual</p>
            <p className="text-[11px] text-muted-foreground/75">{pairLabel}</p>
          </div>
        </div>
        <Badge className={cn("text-[11px] font-semibold tabular-nums", gradeBadgeClass(result.grade))}>
          {result.grade} · {result.score}
        </Badge>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground/80">{disciplineGradeLabel(result.grade)}</p>

      <ul className="mt-3 space-y-1.5">
        {highlights.slice(0, 3).map((field) => (
          <li key={field.field} className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-muted-foreground/75">{field.field}</span>
            <span className={cn("text-right", severityClass(field.severity))}>{field.note}</span>
          </li>
        ))}
      </ul>

      {tradeDetailHref ? (
        <Link
          href={tradeDetailHref}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-glow hover:underline"
        >
          See full breakdown
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </DashboardInsetPanel>
  )
}
