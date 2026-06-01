"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, LayoutDashboard } from "lucide-react"
import { CouncilContextPanel } from "@/components/council/council-context-panel"
import { CouncilInsightsCard } from "@/components/council/council-insights-card"
import { CouncilMemoryStrip } from "@/components/council/council-memory-strip"
import type { CouncilMemoryHighlight, CouncilVisualContext } from "@/lib/council/types"
import { cn } from "@/lib/utils"

type CouncilBriefingContextProps = {
  visual: CouncilVisualContext | null
  insights: string[]
  memoryHighlights: CouncilMemoryHighlight[]
  transcriptLength: number
  isLoading?: boolean
  onChartClick?: (url: string, title: string) => void
  className?: string
}

export function CouncilBriefingContext({
  visual,
  insights,
  memoryHighlights,
  transcriptLength,
  isLoading = false,
  onChartClick,
  className,
}: CouncilBriefingContextProps) {
  const hasContext = Boolean(visual) || insights.length > 0 || memoryHighlights.length > 0
  const [open, setOpen] = useState(true)

  if (isLoading && !hasContext) {
    return (
      <section
        className={cn(
          "rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02] px-4 py-3",
          className,
        )}
      >
        <p className="text-[11px] text-text-muted">Loading stats and charts…</p>
      </section>
    )
  }

  if (!hasContext) return null

  const summaryParts: string[] = []
  if (visual?.stats) summaryParts.push("live stats")
  if ((visual?.watchlistCharts?.length ?? 0) > 0 || visual?.lastTradeChart) {
    summaryParts.push("charts")
  }
  if (insights.length > 0) summaryParts.push(`${insights.length} takeaway${insights.length === 1 ? "" : "s"}`)
  if (memoryHighlights.length > 0) summaryParts.push("agent memory")

  return (
    <section
      className={cn(
        "rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[11px] font-medium text-text-secondary">
            <LayoutDashboard className="size-3.5 shrink-0 text-text-muted" />
            Briefing context
          </span>
          {!open && summaryParts.length > 0 ? (
            <span className="truncate text-[10px] text-text-muted">
              {summaryParts.join(" · ")} — tap for charts &amp; memory
            </span>
          ) : null}
        </span>
        {open ? (
          <ChevronUp className="size-3.5 shrink-0 text-text-muted" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-text-muted" />
        )}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/[0.06] px-2 pb-3 pt-2">
          {(visual?.watchlistCharts?.length ?? 0) > 0 || visual?.lastTradeChart ? (
            <CouncilContextPanel
              visual={visual}
              onChartClick={onChartClick}
              className="border-0 bg-transparent"
              statsHidden
            />
          ) : null}
          <CouncilInsightsCard insights={insights} />
          <CouncilMemoryStrip highlights={memoryHighlights} />
        </div>
      ) : null}
    </section>
  )
}
