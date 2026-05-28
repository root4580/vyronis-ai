"use client"

import { useState } from "react"
import { Brain, ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import type { CognitiveIntelligenceSnapshot } from "@/lib/cognitive/types"
import { cn } from "@/lib/utils"

type CognitiveSurfaceProps = {
  cognitive: CognitiveIntelligenceSnapshot | null | undefined
  className?: string
}

const STATE_STYLES: Record<string, string> = {
  calm: "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-100/95",
  focused: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-100/95",
  disciplined: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-100/95",
  impulsive: "border-orange-500/30 bg-orange-500/[0.08] text-orange-100/95",
  revenge_driven: "border-rose-500/35 bg-rose-500/[0.1] text-rose-100/95",
  fatigued: "border-amber-500/30 bg-amber-500/[0.08] text-amber-100/95",
  euphoric: "border-violet-500/30 bg-violet-500/[0.08] text-violet-100/95",
}

const COACHING_LABELS: Record<string, string> = {
  calm_analytical: "Calm analytical",
  strict_funded_guardian: "Funded guardian",
  emotional_reset: "Emotional reset",
  anti_revenge: "Anti-revenge",
  confidence_restoration: "Confidence restore",
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ")
}

export function CognitiveSurface({ cognitive, className }: CognitiveSurfaceProps) {
  const [expanded, setExpanded] = useState(false)

  if (!cognitive) return null

  const { state, coaching, marketEnvironment, predictions, confidenceGraph, memory } =
    cognitive
  const stateStyle = STATE_STYLES[state.primary] ?? STATE_STYLES.calm
  const envLabels = marketEnvironment.labels.filter((l) => l !== "neutral")

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border px-3 py-2.5 backdrop-blur-sm",
        stateStyle,
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
          <Brain className="size-3.5 opacity-90" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium capitalize">
                {formatLabel(state.primary)}
              </span>
              <span className="text-[10px] opacity-70">
                {COACHING_LABELS[coaching.mode] ?? formatLabel(coaching.mode)}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">{coaching.headline}</p>
          </div>

          <div className="flex flex-wrap gap-1">
            {(envLabels.length > 0 ? envLabels : [marketEnvironment.primary]).map((label) => (
              <span
                key={label}
                className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] capitalize opacity-85"
              >
                {formatLabel(label)}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] opacity-75">
            <span>Strictness {state.verdictStrictness}</span>
            <span>Risk perm. {state.riskPermission}</span>
            <span>Revenge {predictions.revengeProbability}%</span>
            <span>Overtrade {predictions.overtradingProbability}%</span>
          </div>

          {(confidenceGraph.fakeConfidence ||
            confidenceGraph.emotionalCertainty ||
            confidenceGraph.hesitationPattern) && (
            <p className="flex items-start gap-1 text-[10px] text-amber-200/90">
              <Sparkles className="mt-0.5 size-3 shrink-0 opacity-70" />
              {confidenceGraph.fakeConfidence
                ? "Perceived confidence may exceed setup quality."
                : confidenceGraph.hesitationPattern
                  ? "Hesitation pattern — wait for clarity."
                  : "High emotional certainty — verify with checklist."}
            </p>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] opacity-70 transition-opacity hover:opacity-100"
          >
            {expanded ? (
              <>
                Less <ChevronUp className="size-3" />
              </>
            ) : (
              <>
                Intelligence layers <ChevronDown className="size-3" />
              </>
            )}
          </button>

          {expanded ? (
            <div className="space-y-1.5 border-t border-white/10 pt-2 text-[10px] leading-relaxed opacity-85">
              <p>{state.narrative}</p>
              <p>{predictions.narrative}</p>
              <p className="italic opacity-75">{memory.crossMemorySynthesis}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
