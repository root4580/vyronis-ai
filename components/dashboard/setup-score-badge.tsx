"use client"

import type { SetupClassification } from "@/lib/trade-coach/setup-score-engine"
import { cn } from "@/lib/utils"

const CLASSIFICATION_STYLES: Record<
  SetupClassification,
  { badge: string; glow: string; label: string }
> = {
  "A+": {
    badge:
      "border-cyan-glow/40 bg-cyan-glow/[0.12] text-cyan-glow shadow-[0_0_16px_rgba(34,211,238,0.22)]",
    glow: "from-cyan-glow/30 via-cyan-glow/10 to-transparent",
    label: "A+ Setup",
  },
  B: {
    badge: "border-profit/30 bg-profit/[0.1] text-profit shadow-[0_0_12px_rgba(34,197,94,0.15)]",
    glow: "from-profit/20 via-profit/5 to-transparent",
    label: "B Setup",
  },
  C: {
    badge: "border-amber-500/30 bg-amber-500/[0.1] text-amber-300",
    glow: "from-amber-500/15 to-transparent",
    label: "C Setup",
  },
  Impulsive: {
    badge: "border-orange-500/35 bg-orange-500/[0.12] text-orange-300 shadow-[0_0_14px_rgba(249,115,22,0.18)]",
    glow: "from-orange-500/20 to-transparent",
    label: "Impulsive",
  },
  Revenge: {
    badge: "border-loss/40 bg-loss/[0.14] text-loss shadow-[0_0_16px_rgba(239,68,68,0.22)]",
    glow: "from-loss/25 to-transparent",
    label: "Revenge",
  },
  "Counter-Trend": {
    badge: "border-violet-400/35 bg-violet-500/[0.12] text-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.18)]",
    glow: "from-violet-500/20 to-transparent",
    label: "Counter-Trend",
  },
}

type SetupScoreBadgeProps = {
  classification: SetupClassification
  score?: number
  size?: "sm" | "md"
  showScore?: boolean
  className?: string
}

export function getSetupScoreBadgeClassName(
  classification: SetupClassification,
  size: "sm" | "md" = "sm",
): string {
  const styles = CLASSIFICATION_STYLES[classification]
  const sizeClass =
    size === "md" ? "h-7 px-2.5 text-[11px]" : "h-6 px-2 text-[10px]"
  return cn(
    "inline-flex items-center gap-1 rounded-full border font-semibold tracking-wide",
    styles.badge,
    sizeClass,
  )
}

export function SetupScoreBadge({
  classification,
  score,
  size = "sm",
  showScore = false,
  className,
}: SetupScoreBadgeProps) {
  const styles = CLASSIFICATION_STYLES[classification]

  return (
    <span
      className={cn(getSetupScoreBadgeClassName(classification, size), className)}
      title={score != null ? `${styles.label} · ${score}/100` : styles.label}
    >
      {classification}
      {showScore && score != null && (
        <span className="font-medium tabular-nums opacity-80">· {score}</span>
      )}
    </span>
  )
}

export function getSetupScoreGlowClass(classification: SetupClassification): string {
  return CLASSIFICATION_STYLES[classification].glow
}

export function getSetupClassificationLabel(classification: SetupClassification): string {
  return CLASSIFICATION_STYLES[classification].label
}
