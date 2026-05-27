"use client"

import { useMemo } from "react"
import {
  AlertTriangle,
  Brain,
  Flame,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
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
  buildMistakeAnalysis,
  type MistakeEntry,
  type MistakeInsight,
  type MistakeTrade,
} from "@/lib/mistake-analysis"

type MistakeAnalysisPanelProps = {
  trades?: MistakeTrade[]
}

function ScoreTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: typeof Shield
  tone: "cyan" | "profit" | "amber"
}) {
  const styles = {
    cyan: "border-cyan-glow/20 bg-cyan-glow/[0.06] text-cyan-glow",
    profit: "border-profit/20 bg-profit/[0.06] text-profit",
    amber: "border-amber-500/20 bg-amber-500/[0.06] text-amber-400",
  }

  return (
    <DashboardInsetPanel className={`glass text-center ${styles[tone]}`}>
      <div className="mx-auto mb-2 flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-black/20">
        <Icon className="size-4" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </DashboardInsetPanel>
  )
}

function MistakeRow({ entry, index, maxCount }: { entry: MistakeEntry; index: number; maxCount: number }) {
  const barValue = maxCount > 0 ? Math.round((entry.count / maxCount) * 100) : 0

  return (
    <div
      className={`mistake-row rounded-xl border p-3 transition-all duration-300 hover:-translate-y-0.5 ${
        entry.dangerous
          ? "border-amber-500/20 bg-amber-500/[0.04] hover:border-amber-500/35 hover:shadow-[0_0_22px_rgba(245,158,11,0.12)]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-cyan-glow/20 hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]"
      }`}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-black/20 text-[11px] font-bold tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <p className="truncate text-sm font-medium text-foreground">{entry.label}</p>
            {entry.dangerous && (
              <Badge className="h-4 border-amber-500/30 bg-amber-500/10 px-1.5 text-[8px] text-amber-300">
                RISK
              </Badge>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
              <span>{entry.count} occurrence{entry.count !== 1 ? "s" : ""}</span>
              <span>{entry.frequency}% of trades</span>
            </div>
            <Progress
              value={barValue}
              className={`h-1.5 bg-white/[0.05] ${
                entry.dangerous
                  ? "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-amber-500/80 [&_[data-slot=progress-indicator]]:to-loss"
                  : "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-cyan-glow/70 [&_[data-slot=progress-indicator]]:to-cyan-glow"
              }`}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Loss link</p>
          <p className={`text-sm font-semibold tabular-nums ${entry.lossRate >= 50 ? "text-loss" : "text-amber-400"}`}>
            {entry.lossCount} · {entry.lossRate}%
          </p>
          {entry.totalLossAmount > 0 && (
            <p className="text-[10px] font-medium tabular-nums text-loss/90">${entry.totalLossAmount.toFixed(0)} lost</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InsightCard({ insight, index }: { insight: MistakeInsight; index: number }) {
  const styles = {
    warning: "border-amber-500/25 bg-amber-500/[0.06] text-amber-200/90",
    success: "border-profit/25 bg-profit/[0.06] text-profit/90",
    insight: "border-cyan-glow/20 bg-cyan-glow/[0.05] text-foreground/90",
  }
  const icons = {
    warning: AlertTriangle,
    success: TrendingUp,
    insight: Sparkles,
  }
  const Icon = icons[insight.type]

  return (
    <div className="mistake-insight-card" style={{ animationDelay: `${index * 60}ms` }}>
      <DashboardInsetPanel className={`glass ${styles[insight.type]}`}>
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 size-4 shrink-0" />
          <p className="text-[12px] leading-relaxed">{insight.message}</p>
        </div>
      </DashboardInsetPanel>
    </div>
  )
}

export function MistakeAnalysisPanel({ trades }: MistakeAnalysisPanelProps) {
  const analysis = useMemo(() => buildMistakeAnalysis(trades ?? []), [trades])
  const maxLeaderboardCount = analysis.leaderboard[0]?.count ?? 1

  if (!analysis.hasData) {
    return (
      <DashboardCard interactive glow className="glass-card overflow-hidden">
        <DashboardCardHeader title="Mistake Analysis" icon={AlertTriangle} />
        <DashboardCardBody>
          <DashboardEmptyState
            icon={AlertTriangle}
            title="No mistake data yet"
            description="Tag mistakes when logging trades to unlock behavioral analytics"
            className="min-h-[220px]"
          />
        </DashboardCardBody>
      </DashboardCard>
    )
  }

  return (
    <DashboardCard interactive glow className="glass-card floating-glow overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-loss/[0.04]" />
      <div className="pointer-events-none absolute -left-10 top-0 size-40 rounded-full bg-amber-500/[0.05] blur-3xl" />
      <DashboardCardHeader
        title="Mistake Analysis"
        icon={AlertTriangle}
        badge={
          <Badge
            variant="outline"
            className="h-5 border-amber-500/30 bg-amber-500/[0.08] text-[9px] font-semibold tracking-wider text-amber-400 live-pulse"
          >
            BEHAVIOR ENGINE
          </Badge>
        }
      />
      <DashboardCardBody className="relative space-y-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DashboardInsetPanel className="glass border-cyan-glow/15 bg-cyan-glow/[0.04]">
            <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-glow/80">Most Common Mistake</p>
            {analysis.topRepeated ? (
              <>
                <p className="mt-1 text-lg font-semibold text-foreground">{analysis.topRepeated.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/75">
                  {analysis.topRepeated.count} occurrence{analysis.topRepeated.count !== 1 ? "s" : ""} · {analysis.topRepeated.frequency}% of trades
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground/70">Not enough tagged data</p>
            )}
          </DashboardInsetPanel>

          <DashboardInsetPanel className="glass border-loss/20 bg-loss/[0.05] shadow-[0_0_20px_rgba(239,68,68,0.08)]">
            <p className="text-[10px] uppercase tracking-[0.12em] text-loss/80">Biggest Loss Cause</p>
            {analysis.biggestLossCauses[0] ? (
              <>
                <p className="mt-1 text-lg font-semibold text-loss">{analysis.biggestLossCauses[0].label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/75">
                  ${analysis.biggestLossCauses[0].totalLossAmount.toFixed(0)} lost · {analysis.biggestLossCauses[0].lossCount} losing trades
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground/70">No loss-linked mistakes yet</p>
            )}
          </DashboardInsetPanel>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ScoreTile label="Discipline Score" value={analysis.disciplineScore} icon={Shield} tone="cyan" />
          <ScoreTile
            label="Emotional Consistency"
            value={analysis.emotionalConsistencyScore}
            icon={Brain}
            tone="profit"
          />
          <ScoreTile
            label="Dangerous Habits"
            value={analysis.dangerousBehaviors.length}
            icon={Flame}
            tone="amber"
          />
        </div>

        {analysis.mostImproved && (
          <DashboardInsetPanel className="glass border-profit/20 bg-profit/[0.05]">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-profit/25 bg-profit/10">
                <Trophy className="size-4 text-profit" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-profit/80">Most Improved Behavior</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{analysis.mostImproved.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/75">
                  Down {analysis.mostImproved.improvement}% vs earlier trades
                </p>
              </div>
            </div>
          </DashboardInsetPanel>
        )}

        {analysis.insights.length > 0 && (
          <div className="space-y-2">
            <DashboardMetricLabel>Behavior Insights</DashboardMetricLabel>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {analysis.insights.map((insight, index) => (
                <InsightCard key={insight.id} insight={insight} index={index} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <DashboardMetricLabel>Mistake Leaderboard</DashboardMetricLabel>
              {analysis.topRepeated && (
                <span className="text-[10px] text-muted-foreground/60">
                  Top: {analysis.topRepeated.label}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {analysis.leaderboard.length > 0 ? (
                analysis.leaderboard.map((entry, index) => (
                  <MistakeRow key={entry.id} entry={entry} index={index} maxCount={maxLeaderboardCount} />
                ))
              ) : (
                <DashboardInsetPanel className="text-[11px] text-muted-foreground/70">
                  No tagged mistakes yet — behaviors are inferred from emotions and trade data.
                </DashboardInsetPanel>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <DashboardMetricLabel>Dangerous Behaviors</DashboardMetricLabel>
            <div className="space-y-2">
              {analysis.dangerousBehaviors.length > 0 ? (
                analysis.dangerousBehaviors.map((entry, index) => (
                  <MistakeRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    maxCount={analysis.dangerousBehaviors[0]?.count ?? 1}
                  />
                ))
              ) : (
                <DashboardInsetPanel className="text-[11px] text-muted-foreground/70">
                  No dangerous patterns flagged in current sample.
                </DashboardInsetPanel>
              )}
            </div>

            {analysis.biggestLossCauses.length > 0 && (
              <DashboardInsetPanel className="glass mt-3 border-loss/20 bg-loss/[0.04]">
                <p className="text-[10px] uppercase tracking-[0.12em] text-loss/80">Top Loss Drivers</p>
                <div className="mt-2 space-y-2">
                  {analysis.biggestLossCauses.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground/85">{entry.label}</span>
                      <span className="font-semibold tabular-nums text-loss">${entry.totalLossAmount.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </DashboardInsetPanel>
            )}

            {analysis.strategyInsight && (
              <DashboardInsetPanel className="glass border-cyan-glow/15 bg-cyan-glow/[0.04]">
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 size-4 shrink-0 text-cyan-glow" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-glow/80">Strategy Link</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">{analysis.strategyInsight}</p>
                  </div>
                </div>
              </DashboardInsetPanel>
            )}
          </div>
        </div>
      </DashboardCardBody>
    </DashboardCard>
  )
}
