"use client"

import { useState } from "react"
import type { ReplayScenarioId } from "@/lib/trading-os/types"
import { cn } from "@/lib/utils"

type ReplaySimulatorPanelProps = {
  tradeId?: string | null
  scenarios: Array<{
    scenarioId: ReplayScenarioId
    question: string
    narrative: string
    processImpact: string
    estimatedOutcomeShift: string
  }>
  primaryLesson: string
  className?: string
}

const SCENARIO_LABELS: Record<ReplayScenarioId, string> = {
  respect_sl: "Respect SL",
  wait_confirmation: "Wait confirmation",
  reduce_size: "Reduce size",
  no_revenge_entry: "No revenge",
  follow_plan: "Follow plan",
}

export function ReplaySimulatorPanel({
  tradeId,
  scenarios,
  primaryLesson,
  className,
}: ReplaySimulatorPanelProps) {
  const [active, setActive] = useState<ReplayScenarioId>("respect_sl")
  const selected = scenarios.find((s) => s.scenarioId === active) ?? scenarios[0]

  if (!selected) return null

  return (
    <div className={cn("rounded-lg border border-white/[0.08] bg-white/[0.02] p-4", className)}>
      <p className="text-[11px] font-medium text-foreground/88">AI replay simulator</p>
      {tradeId ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground/65">Trade {tradeId.slice(0, 8)}…</p>
      ) : null}
      <p className="mt-2 text-[12px] text-muted-foreground/85">{primaryLesson}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {scenarios.map((s) => (
          <button
            key={s.scenarioId}
            type="button"
            onClick={() => setActive(s.scenarioId)}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] transition-colors",
              active === s.scenarioId
                ? "border-cyan-glow/40 bg-cyan-glow/10 text-cyan-glow"
                : "border-white/10 text-muted-foreground/75 hover:border-white/20",
            )}
          >
            {SCENARIO_LABELS[s.scenarioId]}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2 rounded-md border border-white/[0.06] bg-black/20 p-3">
        <p className="text-[11px] font-medium text-foreground/90">{selected.question}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/85">{selected.narrative}</p>
        <p className="text-[10px] text-muted-foreground/70">{selected.processImpact}</p>
        <p className="text-[10px] capitalize text-cyan-glow/75">
          Outcome shift: {selected.estimatedOutcomeShift}
        </p>
      </div>
    </div>
  )
}
