"use client"

import { Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard/dashboard-primitives"
import {
  disciplineGradeLabel,
  type FieldDeviation,
  type PlanDisciplineResult,
} from "@/lib/trade-planner/deviation-engine"
import { cn } from "@/lib/utils"

type PlanDeviationFullProps = {
  pairLabel: string
  result: PlanDisciplineResult
  className?: string
}

function severityRowClass(severity: FieldDeviation["severity"]): string {
  switch (severity) {
    case "green":
      return "border-profit/15 bg-profit/[0.04]"
    case "amber":
      return "border-warning/20 bg-warning/[0.05]"
    case "red":
      return "border-loss/20 bg-loss/[0.05]"
    default:
      return "border-white/[0.06] bg-white/[0.02]"
  }
}

function deviationLabel(field: FieldDeviation): string {
  if (field.severity === "na") return "—"
  if (field.deviationPercent == null) return field.severity === "green" ? "Match" : "Off"
  if (field.deviationPercent <= 10) return `${field.deviationPercent.toFixed(0)}% · match`
  return `${field.deviationPercent.toFixed(0)}% off`
}

export function PlanDeviationFull({ pairLabel, result, className }: PlanDeviationFullProps) {
  return (
    <DashboardCard interactive className={cn("glass-card", className)}>
      <DashboardCardHeader title="Plan vs actual" icon={Target} />
      <DashboardCardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium text-foreground/90">{pairLabel}</p>
            <p className="text-[11px] text-muted-foreground/75">{disciplineGradeLabel(result.grade)}</p>
          </div>
          <Badge className="border-cyan-glow/25 bg-cyan-glow/[0.08] text-[11px] tabular-nums text-cyan-glow">
            Discipline {result.grade} · {result.score}/100
          </Badge>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.8fr] gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[9px] font-medium text-text-muted">
            <span>Field</span>
            <span>Planned</span>
            <span>Actual</span>
            <span className="text-right">Deviation</span>
          </div>
          {result.fields.map((field) => (
            <div
              key={field.field}
              className={cn(
                "grid grid-cols-[1.1fr_0.9fr_0.9fr_0.8fr] gap-2 border-b border-white/[0.04] px-3 py-2 text-[11px] last:border-b-0",
                severityRowClass(field.severity),
              )}
            >
              <span className="font-medium text-foreground/85">{field.field}</span>
              <span className="tabular-nums text-muted-foreground/80">{field.planned}</span>
              <span className="tabular-nums text-foreground/85">{field.actual}</span>
              <span
                className={cn(
                  "text-right tabular-nums",
                  field.severity === "green"
                    ? "text-profit"
                    : field.severity === "amber"
                      ? "text-warning-foreground"
                      : field.severity === "red"
                        ? "text-loss"
                        : "text-muted-foreground/60",
                )}
              >
                {deviationLabel(field)}
              </span>
            </div>
          ))}
        </div>
      </DashboardCardBody>
    </DashboardCard>
  )
}
