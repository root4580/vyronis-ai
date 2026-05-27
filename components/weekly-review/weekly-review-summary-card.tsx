"use client"

import { Brain, ChevronRight, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { WeeklyReviewReport } from "@/lib/weekly-review/types"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type WeeklyReviewSummaryCardProps = {
  report: WeeklyReviewReport | null
  isGenerating?: boolean
  onOpenReport?: () => void
  onGenerate?: () => void
  className?: string
}

export function WeeklyReviewSummaryCard({
  report,
  isGenerating = false,
  onOpenReport,
  onGenerate,
  className,
}: WeeklyReviewSummaryCardProps) {
  if (!report || !report.hasData) {
    return (
      <DashboardInsetPanel
        className={cn(
          "border-dashed border-cyan-glow/20 bg-cyan-glow/[0.03] px-4 py-5 text-center",
          className,
        )}
      >
        <Brain className="mx-auto size-8 text-cyan-glow/60" />
        <p className="mt-3 text-sm font-medium text-foreground/90">No trades this week yet</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Log journal entries to unlock your AI weekly psychology review.
        </p>
        {onGenerate && (
          <Button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="mt-4 bg-gradient-to-r from-cyan-glow to-cyan-glow/80 text-background"
          >
            {isGenerating ? "Scanning journal…" : "Generate Weekly Review"}
          </Button>
        )}
      </DashboardInsetPanel>
    )
  }

  const pnlTone = report.totalPnL >= 0 ? "WIN" : "LOSS"

  return (
    <DashboardInsetPanel
      className={cn(
        "relative overflow-hidden border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/[0.06] via-black/20 to-violet-500/[0.04] px-4 py-4",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-cyan-glow/[0.12] to-transparent" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-cyan-glow" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/90">
              Weekly AI Summary
            </p>
            <Badge variant="outline" className="h-5 border-white/10 text-[10px]">
              {report.weekLabel}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{report.headline}</p>
          <div className="flex flex-wrap gap-3 text-[11px] tabular-nums text-muted-foreground/80">
            <span>
              Overall{" "}
              <strong className="text-cyan-glow">{report.scores.overall}</strong>/100
            </span>
            <span>
              Discipline <strong className="text-foreground/90">{report.scores.discipline}</strong>
            </span>
            <span className={getPnLTextClass(report.totalPnL, pnlTone)}>
              {formatPnL(report.totalPnL, pnlTone)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {onGenerate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onGenerate}
              disabled={isGenerating}
              className="border-white/[0.1] bg-black/30"
            >
              {isGenerating ? "Regenerating…" : "Regenerate"}
            </Button>
          )}
          {onOpenReport && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenReport}
              className="bg-gradient-to-r from-cyan-glow to-cyan-glow/80 text-background"
            >
              Open Full Report
              <ChevronRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      </div>
    </DashboardInsetPanel>
  )
}
