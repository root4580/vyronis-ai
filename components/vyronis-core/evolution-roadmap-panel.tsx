"use client"

import type { VyronisCoreSnapshot } from "@/lib/vyronis-core/types"
import { cn } from "@/lib/utils"

type EvolutionRoadmapPanelProps = {
  vyronisCore: VyronisCoreSnapshot | null | undefined
  className?: string
}

const STATUS_DOT = {
  active: "bg-emerald-400",
  partial: "bg-amber-400",
  planned: "bg-white/25",
} as const

export function EvolutionRoadmapPanel({ vyronisCore, className }: EvolutionRoadmapPanelProps) {
  if (!vyronisCore) return null

  const { phases, philosophy, overallMaturity, currentPhaseFocus } = vyronisCore

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-lg border border-cyan-glow/20 bg-cyan-glow/[0.04] px-4 py-4">
        <p className="text-sm font-medium text-foreground/95">{philosophy.tagline}</p>
        <ul className="mt-2 space-y-1">
          {philosophy.pillars.map((p) => (
            <li key={p} className="text-[11px] text-muted-foreground/85">
              · {p}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-4 text-[11px]">
          <span>
            Overall maturity:{" "}
            <strong className="text-cyan-glow">{overallMaturity}%</strong>
          </span>
          <span>
            Current build focus: <strong>Phase {currentPhaseFocus}</strong>
          </span>
        </div>
      </div>

      {phases.map((phase) => (
        <div
          key={phase.phase}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/65">
                Phase {phase.phase}
              </p>
              <h3 className="text-sm font-semibold text-foreground/92">{phase.title}</h3>
              <p className="mt-1 text-[11px] italic text-muted-foreground/75">{phase.goalFeeling}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold tabular-nums text-cyan-glow/90">
                {phase.completionPercent}%
              </p>
              <p className="text-[10px] text-muted-foreground/65">complete</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">{phase.goal}</p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {phase.capabilities.map((cap) => (
              <li
                key={cap.id}
                className="flex items-center gap-2 text-[10px] text-muted-foreground/85"
              >
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[cap.status])}
                />
                <span className="min-w-0 truncate">{cap.label}</span>
                <span className="shrink-0 capitalize opacity-50">{cap.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
