"use client"

import type { TradeQualityGrade } from "@/lib/trade-coach/trade-quality-engine"
import {
  GRADE_TONE_CLASSES,
  gradeTone,
} from "@/lib/intelligence/setup-grade-display"
import { cn } from "@/lib/utils"

type SetupGradeBadgeProps = {
  grade: TradeQualityGrade
  label?: string
  className?: string
  size?: "sm" | "md"
}

export function SetupGradeBadge({
  grade,
  label = "Setup",
  className,
  size = "sm",
}: SetupGradeBadgeProps) {
  const tone = gradeTone(grade)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-semibold tabular-nums",
        GRADE_TONE_CLASSES[tone],
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className,
      )}
    >
      <span className="opacity-75">{label}</span>
      <span>{grade}</span>
    </span>
  )
}
