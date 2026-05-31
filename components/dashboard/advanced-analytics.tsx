"use client"

import { useMemo } from "react"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Flame,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
  DashboardInsetPanel,
  DashboardMetricLabel,
} from "@/components/dashboard/dashboard-primitives"
import {
  buildAdvancedAnalytics,
  formatRR,
  type AnalyticsTrade,
} from "@/lib/analytics-engine"
import { formatStrategyPnL } from "@/lib/strategy-performance"

type AdvancedAnalyticsPanelProps = {
  trades?: AnalyticsTrade[]
}

function HighlightTile({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  tone: "best" | "worst" | "neutral"
  icon: typeof Target
}) {
  const styles = {
    best: "border-profit/25 bg-profit/[0.06] hover:border-profit/40 hover:shadow-[0_0_24px_rgb(from var(--color-profit) r g b / 0.12)]",
    worst: "border-loss/25 bg-loss/[0.06] hover:border-loss/40 hover:shadow-[0_0_24px_rgb(from var(--color-loss) r g b / 0.12)]",
    neutral: "border-cyan-glow/20 bg-cyan-glow/[0.05] hover:border-cyan-glow/35 hover:shadow-[0_0_24px_rgb(from var(--color-accent) r g b / 0.1)]",
  }

  const iconStyles = {
    best: "border-profit/20 bg-profit/10 text-profit",
    worst: "border-loss/20 bg-loss/10 text-loss",
    neutral: "border-cyan-glow/20 bg-cyan-glow/10 text-cyan-glow",
  }

  return (
    <div
      className={`strategy-card rounded-xl border p-3 transition-all duration-300 hover:-translate-y-0.5 ${styles[tone]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground/70">{sub}</p>}
        </div>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${iconStyles[tone]}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  )
}

export function AdvancedAnalyticsPanel({ trades }: AdvancedAnalyticsPanelProps) {
  const analytics = useMemo(() => buildAdvancedAnalytics(trades ?? []), [trades])

  if (!analytics.hasData) {
    return (
      <DashboardCard interactive glow className="glass-card overflow-hidden">
        <DashboardCardHeader title="Advanced Analytics" icon={BarChart3} />
        <DashboardCardBody>
          <DashboardEmptyState
            icon={BarChart3}
            title="No analytics data yet"
            description="Log trades to unlock pair performance, consistency, and R:R analysis"
            className="min-h-[200px]"
          />
        </DashboardCardBody>
      </DashboardCard>
    )
  }

  const streakLabel =
    analytics.streaks.current.count > 0
      ? `${analytics.streaks.current.count} ${analytics.streaks.current.type === "win" ? "Win" : analytics.streaks.current.type === "loss" ? "Loss" : "Neutral"} Streak`
      : "No active streak"

  return (
    <DashboardCard interactive glow className="glass-card overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.05] via-transparent to-profit/[0.04]" />
      <DashboardCardHeader
        title="Advanced Analytics"
        icon={BarChart3}
        badge={
          <Badge
            variant="outline"
            className="h-5 border-cyan-glow/25 bg-cyan-glow/[0.08] text-[9px] font-semibold tracking-wider text-cyan-glow live-pulse"
          >
            LIVE
          </Badge>
        }
      />
      <DashboardCardBody className="relative space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <HighlightTile
            label="Best Pair"
            value={analytics.bestPair?.pair ?? "—"}
            sub={
              analytics.bestPair
                ? `${formatStrategyPnL(analytics.bestPair.totalPnL)} · ${analytics.bestPair.winRate}% WR`
                : undefined
            }
            tone="best"
            icon={ArrowUpRight}
          />
          <HighlightTile
            label="Worst Pair"
            value={analytics.worstPair?.pair ?? "—"}
            sub={
              analytics.worstPair
                ? `${formatStrategyPnL(analytics.worstPair.totalPnL)} · ${analytics.worstPair.winRate}% WR`
                : undefined
            }
            tone="worst"
            icon={ArrowDownRight}
          />
          <HighlightTile
            label="Consistency Score"
            value={`${analytics.consistencyScore}/100`}
            sub="Rules + emotion + streak stability"
            tone="neutral"
            icon={Target}
          />
          <HighlightTile
            label="Avg R:R"
            value={formatRR(analytics.avgRR)}
            sub={
              analytics.avgWin > 0
                ? `Win $${analytics.avgWin.toFixed(0)} / Loss $${analytics.avgLoss.toFixed(0)}`
                : undefined
            }
            tone="neutral"
            icon={TrendingUp}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DashboardInsetPanel className="glass space-y-3">
            <div className="flex items-center justify-between">
              <DashboardMetricLabel>Streak Tracking</DashboardMetricLabel>
              <Zap className="size-3.5 text-warning-foreground" />
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p
                  className={`text-3xl font-semibold tabular-nums ${
                    analytics.streaks.current.type === "win"
                      ? "text-profit"
                      : analytics.streaks.current.type === "loss"
                        ? "text-loss"
                        : "text-muted-foreground"
                  }`}
                >
                  {analytics.streaks.current.count || "—"}
                </p>
                <p className="text-[11px] text-muted-foreground/70">{streakLabel}</p>
              </div>
              <div className="space-y-1 text-[11px] text-muted-foreground/80">
                <p>
                  Longest win streak:{" "}
                  <span className="font-semibold text-profit">{analytics.streaks.longestWin}</span>
                </p>
                <p>
                  Longest loss streak:{" "}
                  <span className="font-semibold text-loss">{analytics.streaks.longestLoss}</span>
                </p>
              </div>
            </div>
          </DashboardInsetPanel>

          <DashboardInsetPanel className="glass space-y-3">
            <div className="flex items-center justify-between">
              <DashboardMetricLabel>Consistency Breakdown</DashboardMetricLabel>
              <Flame className="size-3.5 text-cyan-glow" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground/70">Overall consistency</span>
                <span className="font-semibold text-cyan-glow">{analytics.consistencyScore}%</span>
              </div>
              <Progress
                value={analytics.consistencyScore}
                className="h-1.5 bg-white/[0.05] [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-cyan-glow/70 [&_[data-slot=progress-indicator]]:to-profit"
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground/65">
                Based on rule adherence, emotional control, and result stability across{" "}
                {analytics.tradeCount} trades.
              </p>
            </div>
          </DashboardInsetPanel>
        </div>

        {analytics.sessionPerformance.length > 0 && (
          <DashboardInsetPanel className="glass space-y-3">
            <div className="flex items-center justify-between">
              <DashboardMetricLabel>Session Performance</DashboardMetricLabel>
              <Activity className="size-3.5 text-cyan-glow" />
            </div>
            <div className="space-y-2">
              {analytics.sessionPerformance.slice(0, 5).map((session) => (
                <div
                  key={session.name}
                  className="flex items-center justify-between rounded-lg px-1 py-1 text-[12px] transition-colors hover:bg-white/[0.02]"
                >
                  <span className="text-muted-foreground/80">{session.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground/60">{session.tradeCount} trades</span>
                    <span
                      className={`font-medium tabular-nums ${session.pnl >= 0 ? "text-profit" : "text-loss"}`}
                    >
                      {session.pnl >= 0 ? "+" : ""}${session.pnl.toFixed(0)}
                    </span>
                    <span
                      className={`min-w-[2.5rem] text-right font-semibold tabular-nums ${session.winRate >= 50 ? "text-profit" : "text-loss"}`}
                    >
                      {session.winRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DashboardInsetPanel>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
