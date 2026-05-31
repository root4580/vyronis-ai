"use client"

import type { VyronisGrade } from "@/types/strategy"
import { cn } from "@/lib/utils"

const GRADE_STYLES: Record<VyronisGrade, string> = {
  "A+": "border-cyan-glow/45 bg-cyan-glow/[0.14] text-cyan-glow shadow-[0_0_16px_rgba(34,211,238,0.2)]",
  A: "border-profit/40 bg-profit/[0.12] text-profit shadow-[0_0_14px_rgba(34,197,94,0.16)]",
  B: "border-amber-500/35 bg-amber-500/[0.12] text-amber-300",
  Skip: "border-loss/40 bg-loss/[0.12] text-loss shadow-[0_0_14px_rgba(239,68,68,0.16)]",
}

type VyronisGradeBadgeProps = {
  grade: VyronisGrade | string
  score?: number | null
  size?: "sm" | "md" | "lg"
  className?: string
}

export function VyronisGradeBadge({ grade, score, size = "md", className }: VyronisGradeBadgeProps) {
  const resolved = (grade in GRADE_STYLES ? grade : "Skip") as VyronisGrade
  const sizeClass =
    size === "lg"
      ? "px-4 py-2 text-lg font-bold"
      : size === "sm"
        ? "px-2 py-0.5 text-[10px] font-semibold"
        : "px-3 py-1 text-sm font-bold"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border tabular-nums",
        sizeClass,
        GRADE_STYLES[resolved],
        className,
      )}
    >
      {resolved}
      {score != null && <span className="opacity-80">· {score}</span>}
    </span>
  )
}
