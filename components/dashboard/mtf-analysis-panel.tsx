"use client"

import { AlertTriangle, CheckCircle2, Eye, Layers } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { ChartAnnotatedImage } from "@/components/chart-annotations/chart-annotated-image"
import { ChartOverlayToggle } from "@/components/chart-annotations/chart-overlay-toggle"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { ChartOverlayMode } from "@/lib/chart-annotations/types"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { TradeCoachSessionWithMessages } from "@/lib/trade-coach/types"
import { resolveSessionChartCards } from "@/lib/chart-annotations/session-overlays"
import { getProviderDisplayLabel } from "@/lib/ai/providers"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"

type MtfAnalysisPanelProps = {
  analysis: MtfAnalysisResult
  session?: TradeCoachSessionWithMessages | null
  compact?: boolean
  onOpenChart?: (input: {
    url: string
    title: string
    timeframe: CoachMtfTimeframe
  }) => void
}

function scoreColor(score: number) {
  if (score >= 75) return "text-profit"
  if (score >= 55) return "text-warning-foreground"
  return "text-loss"
}

function biasLabel(bias: string) {
  return bias.charAt(0).toUpperCase() + bias.slice(1)
}

function recommendationColor(recommendation: MtfAnalysisResult["recommendation"]) {
  if (recommendation === "TAKE") return "text-profit"
  if (recommendation === "CAUTION") return "text-warning-foreground"
  return "text-loss"
}

export function MtfAnalysisPanel({
  analysis,
  session,
  compact = false,
  onOpenChart,
}: MtfAnalysisPanelProps) {
  const { bias, entry } = analysis
  const visual = analysis.visualAnalysis?.aggregate
  const provider = analysis.provider || analysis.visualAnalysis?.provider
  const [overlayMode, setOverlayMode] = useState<ChartOverlayMode>("overlay")

  const chartCards = useMemo(
    () => resolveSessionChartCards({ session, analysis }),
    [session, analysis],
  )

  return (
    <DashboardInsetPanel className="dashboard-inset-panel-mobile-compact space-y-2 border-cyan-glow/15 bg-cyan-glow/[0.03] px-2.5 py-2.5 sm:space-y-3 sm:px-3 sm:py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-cyan-glow" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/85">
            Multi-Timeframe Analysis
          </p>
        </div>
        <span className={cn("text-lg font-bold tabular-nums", scoreColor(analysis.overallScore))}>
          {analysis.overallScore}/100
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-cyan-glow/20 bg-cyan-glow/[0.06] px-2 py-0.5 text-[10px] font-medium text-cyan-glow">
          HTF Bias: {biasLabel(bias.overallBias)}
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
            entry.entryConfirmationScore >= 70
              ? "border-profit/25 bg-profit/[0.08] text-profit"
              : entry.entryConfirmationScore >= 50
                ? "border-warning/25 bg-warning/[0.08] text-warning-foreground"
                : "border-loss/25 bg-loss/[0.08] text-loss",
          )}
        >
          Entry confirm {entry.entryConfirmationScore}/100
        </span>
        {provider && (
          <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[9px] text-muted-foreground/75">
            <Eye className="size-3" />
            {getProviderDisplayLabel(provider, analysis.visualAnalysis?.model)}
          </span>
        )}
        <span className="text-[9px] text-muted-foreground/60">
          {analysis.chartsProvided}/5 charts
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground/80">{analysis.summary}</p>

      {!compact && chartCards.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-glow/85">
              AI Chart Overlays
            </p>
            <ChartOverlayToggle mode={overlayMode} onChange={setOverlayMode} compact />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {chartCards.map((card) => (
              <button
                key={card.timeframe}
                type="button"
                onClick={() =>
                  onOpenChart?.({ url: card.url, title: card.label, timeframe: card.timeframe })
                }
                className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/20 text-left transition-colors hover:border-cyan-glow/25"
              >
                <ChartAnnotatedImage
                  src={card.url}
                  alt={card.label}
                  annotations={card.annotations}
                  mode={overlayMode}
                  className="h-28 sm:h-16"
                  imageClassName="h-28 max-h-40 w-full object-cover sm:h-16 sm:max-h-none"
                />
                <div className="space-y-0.5 px-2 py-1">
                  <p className="text-[9px] font-medium text-foreground/85">{card.shortLabel}</p>
                  {card.strategyMatchPercent != null && (
                    <p className="text-[8px] text-cyan-glow/80">
                      Match {card.strategyMatchPercent}%
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {visual && !compact && (
        <div className="grid grid-cols-2 gap-1.5 text-[9px] max-[639px]:grid-cols-1 sm:grid-cols-4">
          {[
            { label: "BOS", active: visual.bosDetected },
            { label: "CHOCH", active: visual.chochDetected },
            { label: "Liquidity", active: visual.liquiditySweepDetected },
            { label: "S/D Zone", active: visual.supplyDemandPresent },
            { label: "EMA", active: visual.emaAlignmentScore >= 65 },
            { label: "Confirm", active: visual.confirmationQuality >= 60 },
            { label: "Counter", active: visual.countertrend },
            { label: "R:R", active: visual.rrQuality >= 60 },
          ].map((chip) => (
            <span
              key={chip.label}
              className={cn(
                "rounded-md border px-2 py-1 text-center font-medium",
                chip.active
                  ? chip.label === "Counter"
                    ? "border-loss/25 bg-loss/[0.08] text-loss"
                    : "border-profit/20 bg-profit/[0.06] text-profit"
                  : "border-white/[0.06] bg-black/10 text-muted-foreground/50",
              )}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {visual && (
        <div className="grid grid-cols-1 gap-1.5 text-[10px] sm:grid-cols-2 sm:gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
            <p className="text-muted-foreground/65">Trade Quality</p>
            <p className={cn("mt-0.5 font-semibold tabular-nums", scoreColor(visual.tradeQualityScore))}>
              {visual.tradeQualityScore}/100 ({visual.tradeQualityGrade})
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
            <p className="text-muted-foreground/65">Confidence</p>
            <p className={cn("mt-0.5 font-semibold tabular-nums", scoreColor(visual.confidenceScore))}>
              {visual.confidenceScore}/100
            </p>
          </div>
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-1 gap-1.5 text-[10px] sm:grid-cols-3 sm:gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
            <p className="text-muted-foreground/65">Weekly</p>
            <p className="mt-0.5 font-semibold capitalize">{bias.weeklyBias}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
            <p className="text-muted-foreground/65">Daily</p>
            <p className="mt-0.5 font-semibold capitalize">{bias.dailyBias}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
            <p className="text-muted-foreground/65">H4</p>
            <p className="mt-0.5 font-semibold capitalize">{bias.h4Bias}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground/65">Bias Alignment</p>
          <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", scoreColor(bias.biasAlignmentScore))}>
            {bias.biasAlignmentScore}/100
          </p>
          <Progress value={bias.biasAlignmentScore} className="mt-1.5 h-1 bg-white/[0.06]" />
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground/65">Entry Confirmation</p>
          <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", scoreColor(entry.entryConfirmationScore))}>
            {entry.entryConfirmationScore}/100
          </p>
          <Progress value={entry.entryConfirmationScore} className="mt-1.5 h-1 bg-white/[0.06]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-[10px] sm:grid-cols-2 sm:gap-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-muted-foreground/65">H1 Setup Quality</p>
          <p className={cn("mt-0.5 font-semibold tabular-nums", scoreColor(entry.h1SetupQuality))}>
            {entry.h1SetupQuality}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-muted-foreground/65">M15 Entry Quality</p>
          <p className={cn("mt-0.5 font-semibold tabular-nums", scoreColor(entry.m15EntryQuality))}>
            {entry.m15EntryQuality}
          </p>
        </div>
      </div>

      {bias.biasWarnings.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/80">
            <AlertTriangle className="size-3" />
            Bias Warnings
          </p>
          {bias.biasWarnings.slice(0, compact ? 2 : 3).map((warning) => (
            <p key={warning} className="text-[10px] text-warning-muted/85">
              {warning}
            </p>
          ))}
        </div>
      )}

      {entry.entryWarnings.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/80">
            <AlertTriangle className="size-3" />
            Entry Warnings
          </p>
          {entry.entryWarnings.slice(0, compact ? 2 : 3).map((warning) => (
            <p key={warning} className="text-[10px] text-warning-muted/85">
              {warning}
            </p>
          ))}
        </div>
      )}

      {entry.entryStrengths.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-profit/80">
            <CheckCircle2 className="size-3" />
            Entry Strengths
          </p>
          {entry.entryStrengths.slice(0, compact ? 2 : 3).map((strength) => (
            <p key={strength} className="text-[10px] text-profit/90">
              {strength}
            </p>
          ))}
        </div>
      )}
    </DashboardInsetPanel>
  )
}
