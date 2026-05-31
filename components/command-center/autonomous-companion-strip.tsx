"use client"

import { Eye, Sparkles } from "lucide-react"
import type { AutonomousIntelligenceSnapshot } from "@/lib/autonomous/types"
import { cn } from "@/lib/utils"

type AutonomousCompanionStripProps = {
  autonomous: AutonomousIntelligenceSnapshot | null | undefined
  className?: string
}

const RISK_STYLES = {
  low: "border-profit/20 bg-profit/[0.06] text-emerald-200/90",
  moderate: "border-warning/25 bg-warning/[0.06] text-amber-100/90",
  elevated: "border-orange-500/30 bg-orange-500/[0.08] text-orange-100/90",
  critical: "border-rose-500/35 bg-rose-500/[0.1] text-rose-100/95",
} as const

export function AutonomousCompanionStrip({
  autonomous,
  className,
}: AutonomousCompanionStripProps) {
  if (!autonomous) return null

  const { shadow, session, proactiveNudges } = autonomous
  const primaryNudge =
    proactiveNudges.find((n) => n.priority === "high") ??
    proactiveNudges[0] ??
    null
  const message = primaryNudge?.message ?? shadow.proactiveMessage
  const riskStyle = RISK_STYLES[shadow.overallRiskLevel]

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border px-3 py-2.5 backdrop-blur-sm",
        riskStyle,
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
          {shadow.shouldPause ? (
            <Eye className="size-3.5 opacity-90" />
          ) : (
            <Sparkles className="size-3.5 opacity-80" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] leading-relaxed text-inherit/95">{message}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] opacity-75">
            <span>Shadow · emotional {shadow.emotionalRiskScore}</span>
            <span>discipline {shadow.disciplineConfidence}</span>
            <span>execution {shadow.executionQualityPrediction}</span>
            <span className="capitalize">{session.marketContext.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
