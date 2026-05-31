"use client"

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import {
  SetupScoreBadge,
  getSetupScoreGlowClass,
  getSetupClassificationLabel,
} from "@/components/dashboard/setup-score-badge"
import type { SetupScoreResult } from "@/lib/trade-coach/setup-score-engine"
import { cn } from "@/lib/utils"

type SetupScorePanelProps = {
  result: SetupScoreResult
  compact?: boolean
}

const BREAKDOWN_LABELS: { key: keyof SetupScoreResult["breakdown"]; label: string }[] = [
  { key: "htfAlignment", label: "HTF Alignment" },
  { key: "confirmation", label: "Confirmation" },
  { key: "timing", label: "Timing" },
  { key: "riskReward", label: "R:R" },
  { key: "emotionalState", label: "Emotion" },
  { key: "ruleFollowing", label: "Rules" },
]

function dimensionColor(value: number): string {
  if (value >= 80) return "text-cyan-glow"
  if (value >= 65) return "text-profit"
  if (value >= 50) return "text-warning-foreground"
  return "text-loss"
}

function insightToneClass(type: SetupScoreResult["insights"][number]["type"]): string {
  if (type === "positive") return "border-profit/20 bg-profit/[0.06] text-profit/90"
  if (type === "pattern") return "border-violet-400/20 bg-violet-500/[0.06] text-violet-200/90"
  return "border-loss/20 bg-loss/[0.06] text-loss/90"
}

export function SetupScorePanel({ result, compact = false }: SetupScorePanelProps) {
  return (
    <DashboardInsetPanel
      className={cn(
        "relative overflow-hidden border-white/[0.08] bg-black/20",
        compact ? "space-y-2.5 px-3 py-3" : "space-y-3.5 px-4 py-4",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-60",
          getSetupScoreGlowClass(result.classification),
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-cyan-glow" />
          <div>
            <p className="text-[10px] font-medium text-foreground/85">
              A+ setup score
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              {getSetupClassificationLabel(result.classification)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SetupScoreBadge classification={result.classification} score={result.score} size="md" showScore />
          <span className="text-[10px] tabular-nums text-muted-foreground/70">{result.score}/100</span>
        </div>
      </div>

      <Progress value={result.score} className="relative h-2 bg-white/[0.06]" />

      {!compact && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BREAKDOWN_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2"
            >
              <p className="text-[9px] font-medium text-text-muted">{label}</p>
              <p className={cn("mt-0.5 text-sm font-bold tabular-nums", dimensionColor(result.breakdown[key]))}>
                {result.breakdown[key]}
              </p>
            </div>
          ))}
        </div>
      )}

      {result.insights.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-medium text-cyan-glow/80">
            AI coaching
          </p>
          {result.insights.slice(0, compact ? 2 : 4).map((insight) => (
            <div
              key={insight.id}
              className={cn(
                "rounded-xl border px-3 py-2 text-[11px] leading-relaxed text-foreground/90",
                insightToneClass(insight.type),
              )}
            >
              {insight.message}
            </div>
          ))}
        </div>
      )}

      {!compact && result.warnings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-medium text-warning-foreground/80">Warnings</p>
          {result.warnings.slice(0, 3).map((warning) => (
            <div key={warning} className="flex items-start gap-1.5 text-[10px] text-warning-muted/85">
              <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning-foreground" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {!compact && result.strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-medium text-profit/80">Strengths</p>
          {result.strengths.slice(0, 3).map((strength) => (
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
