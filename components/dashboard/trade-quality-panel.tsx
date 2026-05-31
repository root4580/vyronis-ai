"use client"

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { TradeQualityResult } from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

type TradeQualityPanelProps = {
  quality: TradeQualityResult
  compact?: boolean
  /** War Room / TradingView alert grade (A+/B/C/D) — shown when different from check-in grade */
  warRoomAlertGrade?: string | null
}

function gradeColor(grade: TradeQualityResult["grade"]) {
  if (grade === "A" || grade === "B") return "text-profit"
  if (grade === "C") return "text-warning-foreground"
  return "text-loss"
}

function recommendationColor(recommendation: TradeQualityResult["recommendation"]) {
  if (recommendation === "TAKE") return "text-profit"
  if (recommendation === "CAUTION") return "text-warning-foreground"
  return "text-loss"
}

export function TradeQualityPanel({
  quality,
  compact = false,
  warRoomAlertGrade,
}: TradeQualityPanelProps) {
  return (
    <DashboardInsetPanel className="space-y-3 border-cyan-glow/20 bg-cyan-glow/[0.04] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-cyan-glow" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/85">
              Trade Quality Analysis
            </p>
            <p className="text-[9px] text-muted-foreground/60">
              After your check-in — separate from the alert bell grade
            </p>
          </div>
        </div>
        <span className={cn("text-xl font-bold tabular-nums", gradeColor(quality.grade))}>
          {quality.grade}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground/75">Quality Score</span>
          <span className={cn("font-semibold tabular-nums", gradeColor(quality.grade))}>
            {quality.score}/100
          </span>
        </div>
        <Progress value={quality.score} className="h-2 bg-white/[0.06]" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-muted-foreground/65">Recommendation</p>
          <p className={cn("mt-0.5 font-semibold", recommendationColor(quality.recommendation))}>
            {quality.recommendation}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
          <p className="text-muted-foreground/65">Confidence</p>
          <p className="mt-0.5 font-semibold tabular-nums text-cyan-glow">{quality.confidence}%</p>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-1.5 text-[9px] text-muted-foreground/75 sm:grid-cols-7">
          {quality.breakdown.biasAlignment != null && (
            <div>Bias {quality.breakdown.biasAlignment}</div>
          )}
          {quality.breakdown.entryConfirmation != null && (
            <div>Entry {quality.breakdown.entryConfirmation}</div>
          )}
          {quality.breakdown.chart != null && (
            <div>{quality.breakdown.biasAlignment != null ? "Chart" : "Vision"} {quality.breakdown.chart}</div>
          )}
          <div>Psychology {quality.breakdown.psychology}</div>
          <div>Risk {quality.breakdown.risk}</div>
          <div>Setup {quality.breakdown.setup}</div>
          <div>Discipline {quality.breakdown.discipline}</div>
          <div>Edge {quality.breakdown.historicalEdge}</div>
        </div>
      )}

      {quality.warnings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/80">
            Warnings
          </p>
          {quality.warnings.slice(0, compact ? 3 : 5).map((warning) => (
            <div key={warning} className="flex items-start gap-1.5 text-[10px] text-warning-muted/85">
              <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning-foreground" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {quality.strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-profit/80">
            Strengths
          </p>
          {quality.strengths.slice(0, compact ? 2 : 4).map((strength) => (
            <div key={strength} className="flex items-start gap-1.5 text-[10px] text-profit/90">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
              <span>{strength}</span>
            </div>
          ))}
        </div>
      )}
    </DashboardInsetPanel>
  )
}
