"use client"

import { Lightbulb } from "lucide-react"
import type { AdaptiveCognitionSnapshot } from "@/lib/adaptive-cognition/types"
import { cn } from "@/lib/utils"

type AdaptiveInsightStripProps = {
  adaptive: AdaptiveCognitionSnapshot | null | undefined
  className?: string
}

export function AdaptiveInsightStrip({ adaptive, className }: AdaptiveInsightStripProps) {
  if (!adaptive) return null

  const top = adaptive.insights[0]
  if (!top && !adaptive.performance.luckyWinWarning) return null

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2.5 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-violet-300/90" />
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-violet-200/70">
            Adaptive insight · {adaptive.identity.archetype}
          </p>
          <p className="text-[11px] leading-relaxed text-violet-100/95">
            {top?.message ?? adaptive.performance.luckyWinWarning}
          </p>
          <p className="text-[10px] italic opacity-75">{adaptive.ecosystem.philosophy}</p>
        </div>
      </div>
    </div>
  )
}
