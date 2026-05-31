"use client"

import type { VyronisGrade } from "@/types/strategy"
import { cn } from "@/lib/utils"

const GRADE_STYLES: Record<VyronisGrade, string> = {
  "A+": "border-cyan-glow/45 bg-cyan-glow/[0.14] text-cyan-glow shadow-[0_0_16px_rgb(from var(--color-accent) r g b / 0.2)]",
  A: "border-profit/40 bg-profit/[0.12] text-profit shadow-[0_0_14px_rgb(from var(--color-profit) r g b / 0.16)]",
  B: "border-warning/35 bg-warning/[0.12] text-warning-foreground",
  Skip: "border-loss/40 bg-loss/[0.12] text-loss shadow-[0_0_14px_rgb(from var(--color-loss) r g b / 0.16)]",
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
