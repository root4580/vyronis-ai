"use client"

import {
  coachVerdictClassName,
  mapCoachVerdict,
  type CoachVerdictDisplay,
} from "@/lib/coach/coach-verdict-display"
import { cn } from "@/lib/utils"

type CoachVerdictBadgeProps = {
  shouldTakeTrade?: "yes" | "caution" | "no" | null
  recommendation?: string | null
  className?: string
}

export function CoachVerdictBadge({
  shouldTakeTrade,
  recommendation,
  className,
}: CoachVerdictBadgeProps) {
  const verdict: CoachVerdictDisplay | null = mapCoachVerdict({
    shouldTakeTrade,
    recommendation,
  })

  if (!verdict) return null

  return (
    <div
      className={cn(
        "inline-flex flex-col gap-1 rounded-xl border px-3 py-2",
        coachVerdictClassName(verdict.tone),
        className,
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{verdict.label}</span>
      <span className="text-[10px] leading-snug opacity-90">{verdict.description}</span>
    </div>
  )
}
