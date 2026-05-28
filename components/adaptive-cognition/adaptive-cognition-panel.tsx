"use client"

import type { AdaptiveCognitionSnapshot } from "@/lib/adaptive-cognition/types"
import { cn } from "@/lib/utils"

type AdaptiveCognitionPanelProps = {
  adaptive: AdaptiveCognitionSnapshot | null | undefined
  className?: string
}

export function AdaptiveCognitionPanel({ adaptive, className }: AdaptiveCognitionPanelProps) {
  if (!adaptive) return null

  const { identity, behavioral, performance, strategic, insights, personalOs } = adaptive

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-4 py-3">
        <p className="text-[11px] font-medium text-violet-200/90">{adaptive.ecosystem.philosophy}</p>
        <p className="mt-2 text-sm text-foreground/90">{identity.becoming}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/75">
          Maturity {identity.overallMaturity}/100 · {identity.archetype}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {identity.dimensions.map((d) => (
          <div
            key={d.key}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium">{d.label}</span>
              <span className="text-[10px] capitalize text-cyan-glow/75">{d.trend}</span>
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">{d.score}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">{d.narrative}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[11px] font-medium">Performance attribution (last trade)</p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] tabular-nums">
          <span>Skill {performance.skill}%</span>
          <span>Discipline {performance.discipline}%</span>
          <span>Luck {performance.luck}%</span>
          <span>Execution {performance.execution}%</span>
          <span>Market {performance.marketConditions}%</span>
        </div>
        {performance.luckyWinWarning ? (
          <p className="mt-2 text-[11px] text-amber-200/90">{performance.luckyWinWarning}</p>
        ) : null}
        <p className="mt-2 text-[10px] text-muted-foreground/75">{performance.narrative}</p>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[11px] font-medium">Behavioral modeling</p>
        <p className="mt-1 text-[11px] text-muted-foreground/85">{behavioral.narrative}</p>
        <ul className="mt-2 space-y-1">
          {behavioral.cycles
            .filter((c) => c.active)
            .map((c) => (
              <li key={c.cycle} className="text-[10px] capitalize text-amber-200/85">
                {c.cycle.replace(/_/g, " ")} — {c.narrative}
              </li>
            ))}
        </ul>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[11px] font-medium">Personal OS · {personalOs.recommendedMode}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/85">{personalOs.dailyReflectionPrompt}</p>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[11px] font-medium">Strategic thinking</p>
        <ul className="mt-2 space-y-2">
          {strategic.items.map((item) => (
            <li key={item.area} className="text-[11px]">
              <span className="font-medium text-foreground/88">{item.headline}</span>
              <span className="text-muted-foreground/80"> — {item.guidance}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[11px] font-medium">Autonomous insights</p>
        <ul className="mt-2 space-y-2">
          {insights.map((insight) => (
            <li key={insight.id} className="text-[11px] leading-relaxed text-muted-foreground/90">
              <span className="text-violet-200/90">{insight.message}</span>
              <span className="ml-2 text-[10px] opacity-60">({insight.confidence}%)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
