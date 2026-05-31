"use client"

import { Progress } from "@/components/ui/progress"
import { scoreTone } from "@/lib/weekly-review/scoring"
import { cn } from "@/lib/utils"

type WeeklyReviewScoreMeterProps = {
  label: string
  score: number
  delayMs?: number
  className?: string
}

const toneBarClass = {
  excellent: "[&>div]:bg-cyan-glow",
  solid: "[&>div]:bg-profit",
  caution: "[&>div]:bg-amber-400",
  critical: "[&>div]:bg-loss",
} as const

const toneTextClass = {
  excellent: "text-cyan-glow",
  solid: "text-profit",
  caution: "text-warning-foreground",
  critical: "text-loss",
} as const

export function WeeklyReviewScoreMeter({
  label,
  score,
  delayMs = 0,
  className,
}: WeeklyReviewScoreMeterProps) {
  const tone = scoreTone(score)

  return (
    <div
      className={cn(
        "weekly-review-meter rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 opacity-0",
        className,
      )}
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "forwards" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
          {label}
        </p>
        <span className={cn("text-lg font-bold tabular-nums", toneTextClass[tone])}>{score}</span>
      </div>
      <Progress
        value={score}
        className={cn("h-2 bg-white/[0.06]", toneBarClass[tone])}
      />
    </div>
  )
}
