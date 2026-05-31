"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Target, TrendingDown, TrendingUp } from "lucide-react"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import { Badge } from "@/components/ui/badge"
import type { PlanDisciplineAggregate } from "@/lib/trade-planner/plan-discipline-aggregate"
import { disciplineGradeLabel } from "@/lib/trade-planner/deviation-engine"
import { cn } from "@/lib/utils"

type PlanDisciplineSummaryWidgetProps = {
  className?: string
}

function gradeBadgeClass(grade: string | null): string {
  switch (grade) {
    case "A":
      return "border-profit/30 bg-profit/[0.12] text-profit"
    case "B":
      return "border-cyan-glow/30 bg-cyan-glow/[0.1] text-cyan-glow"
    case "C":
      return "border-amber-500/30 bg-amber-500/[0.1] text-amber-200"
    default:
      return "border-loss/30 bg-loss/[0.1] text-loss"
  }
}

export function PlanDisciplineSummaryWidget({ className }: PlanDisciplineSummaryWidgetProps) {
  const [aggregate, setAggregate] = useState<PlanDisciplineAggregate | null>(null)
  const [headline, setHeadline] = useState<string>("")
  const [migrationPending, setMigrationPending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const response = await fetch("/api/trade-planner/discipline-summary")
        const payload = await response.json().catch(() => ({}))
        if (cancelled) return
        setAggregate(payload.aggregate ?? null)
        setHeadline(String(payload.headline || ""))
        setMigrationPending(Boolean(payload.migrationPending))
      } catch {
        if (!cancelled) {
          setAggregate(null)
          setHeadline("Could not load plan discipline summary.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const empty = !loading && (aggregate?.linkedTradeCount ?? 0) === 0

  return (
    <DashboardCard interactive className={cn("glass-card", className)}>
      <DashboardCardHeader title="Plan discipline" icon={Target} />
      <DashboardCardBody>
        {loading ? (
          <p className="text-[12px] text-muted-foreground/75">Loading linked plan stats…</p>
        ) : empty ? (
          <DashboardEmptyState
            icon={Target}
            title="No linked plans yet"
            description={
              migrationPending
                ? "Run supabase/032-plan-journal-link.sql, then link a plan when you log your next trade."
                : "Save a plan in Trade Planner, then confirm the match when you Log Trade."
            }
            className="min-h-[120px]"
          />
        ) : aggregate ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[12px] font-medium text-foreground/90">{headline}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/75">
                  {aggregate.weekTradeCount} linked trade(s) this week · {aggregate.linkedTradeCount} total
                </p>
              </div>
              {aggregate.weekGrade ? (
                <Badge className={cn("text-[11px] tabular-nums", gradeBadgeClass(aggregate.weekGrade))}>
                  Week {aggregate.weekGrade}
                  {aggregate.weekAverageScore != null ? ` · ${aggregate.weekAverageScore}` : ""}
                </Badge>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DashboardInsetPanel className="px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/65">This week</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground/90">
                  {aggregate.weekAverageScore != null ? `${aggregate.weekAverageScore}/100` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {aggregate.weekGrade
                    ? disciplineGradeLabel(aggregate.weekGrade)
                    : "Log a linked trade this week"}
                </p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/65">30-day avg</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground/90">
                  {aggregate.monthAverageScore != null ? `${aggregate.monthAverageScore}/100` : "—"}
                </p>
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  {aggregate.trendDelta != null ? (
                    aggregate.trendDelta >= 0 ? (
                      <TrendingUp className="size-3 text-profit" />
                    ) : (
                      <TrendingDown className="size-3 text-loss" />
                    )
                  ) : null}
                  {aggregate.trendDelta != null
                    ? `${aggregate.trendDelta >= 0 ? "+" : ""}${aggregate.trendDelta} vs prior week`
                    : "Trend builds with more links"}
                </p>
              </DashboardInsetPanel>
            </div>

            {aggregate.recentScores.length > 0 ? (
              <div className="space-y-1.5">
                {aggregate.recentScores.map((row) => (
                  <DashboardInsetPanel
                    key={row.tradeId}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div>
                      <Link
                        href={`/journal/trade/${row.tradeId}`}
                        className="text-[11px] font-medium text-foreground/90 hover:text-cyan-glow"
                      >
                        {row.pair}
                      </Link>
                      <p className="text-[10px] text-muted-foreground/65">{row.date}</p>
                    </div>
                    <Badge className={cn("text-[10px] tabular-nums", gradeBadgeClass(row.grade))}>
                      {row.grade} · {row.score}
                    </Badge>
                  </DashboardInsetPanel>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground/75">{headline || "No data yet."}</p>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
