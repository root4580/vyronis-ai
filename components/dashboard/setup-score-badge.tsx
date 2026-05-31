"use client"

import type { SetupClassification } from "@/lib/trade-coach/setup-score-engine"
import { getJournalSetupBadgeClassName } from "@/lib/journal-badges"
import { cn } from "@/lib/utils"

const CLASSIFICATION_LABELS: Record<SetupClassification, string> = {
  "A+": "A+ Setup",
  A: "A Setup",
  B: "B Setup",
  Skip: "Skip",
  C: "C Setup",
  Impulsive: "Impulsive",
  Revenge: "Revenge",
  "Counter-Trend": "Counter-Trend",
}

const CLASSIFICATION_GLOW: Record<SetupClassification, string> = {
  "A+": "from-cyan-glow/30 via-cyan-glow/10 to-transparent",
  A: "from-profit/20 via-profit/5 to-transparent",
  B: "from-profit/20 via-profit/5 to-transparent",
  Skip: "from-loss/25 to-transparent",
  C: "from-warning/15 to-transparent",
  Impulsive: "from-orange-500/20 to-transparent",
  Revenge: "from-loss/25 to-transparent",
  "Counter-Trend": "from-violet-500/20 to-transparent",
}

type SetupScoreBadgeProps = {
  classification: SetupClassification
  score?: number
  size?: "sm" | "md" | "journal"
  showScore?: boolean
  className?: string
}

export function getSetupScoreBadgeClassName(
  classification: SetupClassification,
  size: "sm" | "md" | "journal" = "journal",
): string {
  return getJournalSetupBadgeClassName(classification, size === "sm" ? "journal" : size)
}

export function SetupScoreBadge({
  classification,
  score,
  size = "journal",
  showScore = false,
  className,
}: SetupScoreBadgeProps) {
  const resolvedSize = size === "sm" ? "journal" : size

  return (
    <span
      className={cn(getJournalSetupBadgeClassName(classification, resolvedSize), className)}
      title={
        score != null
          ? `${CLASSIFICATION_LABELS[classification]} · ${score}/100`
          : CLASSIFICATION_LABELS[classification]
      }
    >
      <span className="truncate">{classification}</span>
      {showScore && score != null && (
        <span className="ml-1 font-medium tabular-nums opacity-75">· {score}</span>
      )}
    </span>
  )
}

export function getSetupScoreGlowClass(classification: SetupClassification): string {
  return CLASSIFICATION_GLOW[classification]
}

export function getSetupClassificationLabel(classification: SetupClassification): string {
  return CLASSIFICATION_LABELS[classification]
}
