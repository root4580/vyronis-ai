"use client"

import { Brain } from "lucide-react"
import { getCouncilAgent } from "@/lib/council/agents"
import type { CouncilMemoryHighlight } from "@/lib/council/types"
import { cn } from "@/lib/utils"

type CouncilMemoryStripProps = {
  highlights: CouncilMemoryHighlight[]
  className?: string
}

export function CouncilMemoryStrip({ highlights, className }: CouncilMemoryStripProps) {
  const visible = highlights.filter((item) => item.preview || item.reply).slice(0, 3)
  if (visible.length === 0) return null

  return (
    <section
      className={cn(
        "rounded-[var(--radius-md)] border border-violet-500/20 bg-violet-500/[0.05] px-4 py-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Brain className="size-4 text-violet-200/85" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200/85">
          Agents remember
        </p>
      </div>
      <div className="space-y-2">
        {visible.map((item) => (
          <div
            key={item.agent}
            className="rounded-[var(--radius-sm)] border border-white/[0.06] bg-black/20 px-2.5 py-2"
          >
            <p className="text-[10px] font-semibold text-violet-100/90">
              {getCouncilAgent(item.agent).name}
            </p>
            {item.preview ? (
              <p className="mt-0.5 text-[11px] text-text-muted">You: {item.preview}</p>
            ) : null}
            {item.reply ? (
              <p className="mt-0.5 text-[11px] text-text-secondary">{item.reply}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
