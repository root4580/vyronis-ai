"use client"

import type { TradingOsSnapshot } from "@/lib/trading-os/types"
import { cn } from "@/lib/utils"

type EvolutionDashboardProps = {
  tradingOs: TradingOsSnapshot | null | undefined
  className?: string
}

function TrendBadge({ trend }: { trend: "improving" | "stable" | "declining" }) {
  const styles = {
    improving: "text-emerald-300/90 bg-emerald-500/10 border-emerald-500/25",
    stable: "text-cyan-200/85 bg-cyan-500/10 border-cyan-500/20",
    declining: "text-amber-200/90 bg-amber-500/10 border-amber-500/25",
  }
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[9px] font-medium capitalize",
        styles[trend],
      )}
    >
      {trend}
    </span>
  )
}

function MetricCard({
  metric,
}: {
  metric: TradingOsSnapshot["evolution"]["disciplineTrend"]
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-foreground/90">{metric.label}</span>
        <TrendBadge trend={metric.trend} />
      </div>
      <p className="text-xl font-semibold tabular-nums text-cyan-glow/95">{metric.current}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
        {metric.narrative}
      </p>
    </div>
  )
}

export function EvolutionDashboard({ tradingOs, className }: EvolutionDashboardProps) {
  if (!tradingOs) {
    return (
      <p className="text-sm text-muted-foreground/75">
        Load your journal to unlock trader evolution metrics.
      </p>
    )
  }

  const { evolution, strategy, timeline } = tradingOs

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground/95">Trader evolution</h2>
          <p className="mt-1 text-sm text-muted-foreground/80">
            Long-term discipline, emotion, execution, and setup quality
          </p>
        </div>
        <div className="rounded-lg border border-cyan-glow/25 bg-cyan-glow/[0.06] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Evolution score
          </p>
          <p className="text-2xl font-semibold tabular-nums text-cyan-glow">
            {evolution.overallEvolutionScore}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard metric={evolution.disciplineTrend} />
        <MetricCard metric={evolution.emotionalStability} />
        <MetricCard metric={evolution.executionConsistency} />
        <MetricCard metric={evolution.setupQuality} />
      </div>

      {evolution.bestEnvironment ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <p className="text-[11px] font-medium text-foreground/88">Best environment</p>
          <p className="mt-1 text-sm text-muted-foreground/85">
            {evolution.bestEnvironment.label} — {evolution.bestEnvironment.winRate}% win rate over{" "}
            {evolution.bestEnvironment.tradeCount} trades
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[11px] font-medium text-foreground/88">Weekly report</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/85">
            {evolution.weeklyReport}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[11px] font-medium text-foreground/88">Monthly arc</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/85">
            {evolution.monthlyReport}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[11px] font-medium text-foreground/88">Strategy intelligence</p>
        <ul className="mt-2 space-y-1.5">
          {strategy.adaptiveGuidance.map((line) => (
            <li key={line} className="text-[12px] text-muted-foreground/85">
              · {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[11px] font-medium text-foreground/88">Intelligence timeline</p>
        <p className="mt-1 text-[10px] text-muted-foreground/70">{timeline.narrative}</p>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {timeline.events.slice(0, 12).map((ev) => (
            <li
              key={ev.id}
              className="flex gap-2 border-b border-white/[0.04] pb-2 text-[11px] last:border-0"
            >
              <span className="shrink-0 capitalize text-cyan-glow/70">{ev.type.replace(/_/g, " ")}</span>
              <span className="min-w-0 text-muted-foreground/85">
                <span className="text-foreground/80">{ev.title}</span> — {ev.summary}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
