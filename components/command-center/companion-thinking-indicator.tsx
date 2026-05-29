"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

type CompanionThinkingIndicatorProps = {
  phases: string[]
  className?: string
}

export function CompanionThinkingIndicator({
  phases,
  className,
}: CompanionThinkingIndicatorProps) {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    if (phases.length <= 1) return
    const interval = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % phases.length)
    }, 900)
    return () => window.clearInterval(interval)
  }, [phases])

  const label = phases[phaseIndex] ?? "Thinking…"

  return (
    <div className={cn("companion-thinking flex w-full min-w-0 max-w-full items-start gap-2.5", className)}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan-glow/20 bg-cyan-glow/[0.06]">
        <span className="command-center-typing flex gap-0.5">
          <span />
          <span />
          <span />
        </span>
      </div>
      <div className="min-w-0 max-w-[calc(100%-2.5rem)] rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <p className="break-words text-[11px] text-muted-foreground/80 [overflow-wrap:anywhere]">{label}</p>
      </div>
    </div>
  )
}
