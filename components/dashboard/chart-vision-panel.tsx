"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { ChartVisionResult } from "@/lib/coach/types"
import type { ChartAnalysisResult } from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

type ChartVisionPanelProps = {
  analysis: ChartAnalysisResult
  compact?: boolean
}

function scoreColor(score: number) {
  if (score >= 75) return "text-profit"
  if (score >= 55) return "text-warning-foreground"
  return "text-loss"
}

function trendBadge(bias: ChartVisionResult["trendBias"]) {
  if (bias === "bullish") {
    return {
      label: "Bullish bias",
      className: "border-profit/25 bg-profit/[0.08] text-profit",
      icon: TrendingUp,
    }
  }
  if (bias === "bearish") {
    return {
      label: "Bearish bias",
      className: "border-loss/25 bg-loss/[0.08] text-loss",
      icon: TrendingDown,
    }
  }
  if (bias === "mixed") {
    return {
      label: "Mixed bias",
      className: "border-warning/25 bg-warning/[0.08] text-warning-muted/90",
      icon: TrendingDown,
    }
  }
  return {
    label: "Neutral bias",
    className: "border-white/[0.08] bg-white/[0.04] text-muted-foreground/80",
    icon: TrendingUp,
  }
}

function resolveVision(analysis: ChartAnalysisResult): ChartVisionResult | null {
  return analysis.vision ?? null
}

export function ChartVisionPanel({ analysis, compact = false }: ChartVisionPanelProps) {
  const vision = resolveVision(analysis)
  const visionScore = vision?.visionScore ?? analysis.overallScore
  const executionQuality = vision?.executionQuality ?? analysis.executionQuality
  const confidence = vision?.confidence ?? Math.round(visionScore * 0.85)
  const trend = trendBadge(vision?.trendBias ?? (analysis.countertrend ? "mixed" : "neutral"))
  const TrendIcon = trend.icon
  const warnings = vision?.warnings ?? analysis.warnings ?? []
  const strengths = vision?.strengths ?? analysis.strengths ?? []
  const detectedSetup = vision?.detectedSetup ?? "Chart setup"

  return (
    <DashboardInsetPanel className="space-y-3 border-cyan-glow/15 bg-cyan-glow/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye className="size-3.5 text-cyan-glow" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/85">
            Chart Vision Analysis
          </p>
        </div>
        <span className={cn("text-lg font-bold tabular-nums", scoreColor(visionScore))}>
          {visionScore}/100
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
            trend.className,
          )}
        >
          <TrendIcon className="size-3" />
          {trend.label}
        </span>
        <span className="rounded-md border border-cyan-glow/20 bg-cyan-glow/[0.06] px-2 py-0.5 text-[10px] text-cyan-glow">
          {detectedSetup}
        </span>
        {vision?.provider && (
          <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/55">
            {vision.provider} engine
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        {vision?.summary ?? analysis.summary}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground/65">Execution Quality</p>
          <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", scoreColor(executionQuality))}>
            {executionQuality}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground/65">Vision Confidence</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-cyan-glow">{confidence}%</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground/70">Confidence meter</span>
          <span className="tabular-nums text-cyan-glow">{confidence}%</span>
        </div>
        <Progress value={confidence} className="h-1.5 bg-white/[0.06]" />
      </div>

      {!compact && vision?.metrics && (
        <div className="grid grid-cols-2 gap-1.5 text-[9px] text-muted-foreground/75 sm:grid-cols-4">
          <div>Trend {vision.metrics.emaAlignment}</div>
          <div>Confirm {vision.metrics.confirmationCandleQuality}</div>
          <div>R:R {vision.metrics.rrQuality}</div>
          <div>S/R {vision.metrics.supportResistanceProximity}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(vision?.metrics.countertrend ?? analysis.countertrend) && (
          <span className="inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning/[0.08] px-2 py-0.5 text-[10px] text-warning-muted/90">
            Countertrend
          </span>
        )}
        {(vision?.metrics.overextendedMove ?? analysis.overextendedEntry) && (
          <span className="rounded-md border border-loss/25 bg-loss/[0.08] px-2 py-0.5 text-[10px] text-loss/90">
            Overextended
          </span>
        )}
        {vision?.metrics.breakoutVsRetest && vision.metrics.breakoutVsRetest !== "unknown" && (
          <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-foreground/75">
            {vision.metrics.breakoutVsRetest}
          </span>
        )}
        {vision?.metrics.volatilityState && (
          <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-foreground/75">
            Vol: {vision.metrics.volatilityState}
          </span>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/80">
            <AlertTriangle className="size-3" />
            Warnings
          </p>
          {warnings.slice(0, compact ? 2 : 4).map((warning) => (
            <p key={warning} className="text-[10px] leading-relaxed text-warning-muted/85">
              {warning}
            </p>
          ))}
        </div>
      )}

      {strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-profit/80">
            <CheckCircle2 className="size-3" />
            Strengths
          </p>
          {strengths.slice(0, compact ? 2 : 3).map((strength) => (
            <p key={strength} className="text-[10px] leading-relaxed text-profit/90">
              {strength}
            </p>
          ))}
        </div>
      )}

      {!compact && (vision?.insights?.length ?? analysis.insights?.length ?? 0) > 0 && (
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground/70">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-cyan-glow/80" />
          {(vision?.insights ?? analysis.insights ?? []).join(" · ")}
        </p>
      )}
    </DashboardInsetPanel>
  )
}

/** @deprecated Use ChartVisionPanel */
export const ChartAnalysisPanel = ChartVisionPanel
