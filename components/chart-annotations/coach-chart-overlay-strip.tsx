"use client"

import { Eye } from "lucide-react"
import { ChartAnnotatedImage } from "@/components/chart-annotations/chart-annotated-image"
import { ChartOverlayToggle } from "@/components/chart-annotations/chart-overlay-toggle"
import { resolveSessionChartCards } from "@/lib/chart-annotations/session-overlays"
import type { ChartOverlayMode } from "@/lib/chart-annotations/types"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { TradeCoachSessionWithMessages } from "@/lib/trade-coach/types"
import { useMemo, useState } from "react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"

type CoachChartOverlayStripProps = {
  session: TradeCoachSessionWithMessages | null | undefined
  analysis: MtfAnalysisResult | null | undefined
  compact?: boolean
  title?: string
  onOpenChart?: (input: {
    url: string
    title: string
    timeframe: CoachMtfTimeframe
    annotations: import("@/lib/chart-annotations/types").ChartAnnotation[]
  }) => void
}

export function CoachChartOverlayStrip({
  session,
  analysis,
  compact = false,
  title = "AI Chart Overlays",
  onOpenChart,
}: CoachChartOverlayStripProps) {
  const [overlayMode, setOverlayMode] = useState<ChartOverlayMode>("overlay")
  const chartCards = useMemo(
    () => resolveSessionChartCards({ session, analysis }),
    [session, analysis],
  )
  const confidenceBreakdown = useMemo(() => {
    return (
      analysis?.visualAnalysis?.chartAnnotations?.confidenceBreakdown ||
      session?.chart_annotations?.confidenceBreakdown ||
      session?.planned_context?.chart_annotations?.confidenceBreakdown
    )
  }, [session, analysis])

  if (chartCards.length === 0) return null

  return (
    <DashboardInsetPanel className="space-y-2 border-cyan-glow/20 bg-cyan-glow/[0.04] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Eye className="size-3.5 text-cyan-glow" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/90">
            {title}
          </p>
        </div>
        <ChartOverlayToggle mode={overlayMode} onChange={setOverlayMode} compact />
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        Tap any chart to expand full size with AI overlays.
      </p>
      {confidenceBreakdown && (
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5 text-[9px] text-muted-foreground/80">
          <p className="font-semibold text-cyan-glow/85">
            Confidence {confidenceBreakdown.weightedScore}% — HTF 40% · H4 25% · H1 20% · M15 15%
          </p>
          <p>
            W/D {confidenceBreakdown.htfBiasScore} · H4 {confidenceBreakdown.h4StructureScore} · H1{" "}
            {confidenceBreakdown.h1CleanlinessScore} · M15 {confidenceBreakdown.m15ConfirmationScore}
          </p>
        </div>
      )}
      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        {chartCards.map((card) => (
          <button
            key={card.timeframe}
            type="button"
            onClick={() =>
              onOpenChart?.({
                url: card.url,
                title: card.label,
                timeframe: card.timeframe,
                annotations: card.annotations,
              })
            }
            className="group overflow-hidden rounded-lg border border-white/[0.08] bg-black/25 text-left transition-colors hover:border-cyan-glow/35"
            aria-label={`Expand ${card.label} chart`}
          >
            <ChartAnnotatedImage
              src={card.url}
              alt={card.label}
              annotations={card.annotations}
              mode={overlayMode}
              className={compact ? "h-14" : "h-16"}
              imageClassName={`${compact ? "h-14" : "h-16"} object-cover`}
            />
            <div className="flex items-center justify-between gap-1 px-2 py-1">
              <div className="min-w-0">
                <p className="text-[9px] font-medium text-foreground/85">{card.shortLabel}</p>
                {card.strategyMatchPercent != null && (
                  <p className="text-[8px] text-cyan-glow/75">Match {card.strategyMatchPercent}%</p>
                )}
              </div>
              <span className="text-[8px] font-medium uppercase tracking-[0.08em] text-cyan-glow/70 opacity-0 transition-opacity group-hover:opacity-100">
                Expand
              </span>
            </div>
          </button>
        ))}
      </div>
    </DashboardInsetPanel>
  )
}
