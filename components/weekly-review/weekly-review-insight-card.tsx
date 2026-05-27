"use client"

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react"
import type { WeeklyReviewInsight } from "@/lib/weekly-review/types"
import { cn } from "@/lib/utils"

type WeeklyReviewInsightCardProps = {
  insight: WeeklyReviewInsight
  className?: string
}

function toneStyles(tone: WeeklyReviewInsight["tone"]) {
  if (tone === "positive") {
    return {
      border: "border-profit/25 bg-profit/[0.06]",
      icon: CheckCircle2,
      iconClass: "text-profit",
    }
  }
  if (tone === "warning") {
    return {
      border: "border-loss/25 bg-loss/[0.06]",
      icon: AlertTriangle,
      iconClass: "text-loss",
    }
  }
  return {
    border: "border-cyan-glow/20 bg-cyan-glow/[0.05]",
    icon: Sparkles,
    iconClass: "text-cyan-glow",
  }
}

export function WeeklyReviewInsightCard({ insight, className }: WeeklyReviewInsightCardProps) {
  const styles = toneStyles(insight.tone)
  const Icon = styles.icon

  return (
    <div
      className={cn(
        "weekly-review-insight rounded-xl border px-3 py-3 transition-colors",
        styles.border,
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-3.5 shrink-0", styles.iconClass)} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/80">
            {insight.title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground/88">{insight.message}</p>
        </div>
      </div>
    </div>
  )
}
