"use client"

import { Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

type CouncilInsightsCardProps = {
  insights: string[]
  className?: string
}

export function CouncilInsightsCard({ insights, className }: CouncilInsightsCardProps) {
  const visible = insights.filter((line) => line.trim()).slice(0, 4)
  if (visible.length === 0) return null

  return (
    <section
      className={cn(
        "rounded-[var(--radius-md)] border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="size-4 text-amber-200/90" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/90">
          Briefing takeaways
        </p>
      </div>
      <ul className="space-y-1.5">
        {visible.map((line, index) => (
          <li key={`${index}-${line.slice(0, 24)}`} className="flex gap-2 text-[12px] leading-relaxed text-text-secondary">
            <span className="text-amber-200/70">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
