"use client"

import { Loader2, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { useTradeQualityAnalytics } from "@/hooks/use-trade-quality-analytics"
import { cn } from "@/lib/utils"

type TradeQualityAnalyticsPanelProps = {
  refreshKey?: number
}

export function TradeQualityAnalyticsPanel({ refreshKey = 0 }: TradeQualityAnalyticsPanelProps) {
  const { analytics, isLoading, error } = useTradeQualityAnalytics(refreshKey)

  if (isLoading) {
    return (
      <DashboardInsetPanel className="flex min-h-[96px] items-center justify-center border-white/[0.06] bg-white/[0.02]">
        <Loader2 className="size-4 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    )
  }

  if (error || !analytics) {
    return (
      <DashboardInsetPanel className="border-loss/20 bg-loss/[0.05] px-3 py-2.5">
        <p className="text-[11px] text-loss/90">{error || "Quality analytics unavailable"}</p>
      </DashboardInsetPanel>
    )
  }

  if (!analytics.hasData) {
    return (
      <DashboardInsetPanel className="border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground/75">{analytics.summary}</p>
      </DashboardInsetPanel>
    )
  }

  return (
    <DashboardInsetPanel className="space-y-3 border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex items-center gap-2">
        <Target className="size-3.5 text-cyan-glow" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/85">
          Quality Analytics
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground/80">{analytics.summary}</p>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-cyan-glow/15 bg-cyan-glow/[0.04] px-2.5 py-2">
          <p className="text-muted-foreground/65">Avg Quality</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-glow">
            {analytics.averageQualityScore}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <p className="text-muted-foreground/65">Discipline Corr.</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground/90">
            {analytics.disciplineCorrelation.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <p className="text-muted-foreground/65">Low Quality WR</p>
          <p className="mt-0.5 font-semibold tabular-nums text-warning-foreground">
            {analytics.lowQualityPerformance.winRate}%
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <p className="text-muted-foreground/65">Avg Discipline</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground/90">
            {analytics.averageDisciplineScore}
          </p>
        </div>
      </div>

      {analytics.winRateByGrade.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {analytics.winRateByGrade.map((row) => (
            <Badge key={row.grade} variant="outline" className="h-6 text-[10px]">
              {row.grade}: {row.winRate}% WR ({row.count})
            </Badge>
          ))}
        </div>
      )}

      {analytics.bestQualityTrades.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
            Best Quality Plans
          </p>
          {analytics.bestQualityTrades.map((trade) => (
            <div
              key={trade.sessionId}
              className="flex items-center justify-between gap-2 rounded-lg border border-profit/15 bg-profit/[0.04] px-2.5 py-1.5 text-[10px]"
            >
              <span className={cn("font-semibold", trade.grade === "A" ? "text-profit" : "text-cyan-glow")}>
                {trade.grade} · {trade.score}/100
              </span>
              <span className="text-muted-foreground/70">{trade.result || "Planned"}</span>
            </div>
          ))}
        </div>
      )}
    </DashboardInsetPanel>
  )
}
