"use client"

import { Sparkles } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import {
  SetupScoreBadge,
  getSetupClassificationLabel,
  getSetupScoreGlowClass,
} from "@/components/dashboard/setup-score-badge"
import type { ScannerScoreResult } from "@/lib/scanner/scoring"
import { scannerGradeToBadgeClassification } from "@/lib/scanner/scoring"
import { cn } from "@/lib/utils"

type APlusScoreProps = {
  scoring: ScannerScoreResult
  confidence: number
  compact?: boolean
  className?: string
}

function factorTone(points: number, maxPoints: number): string {
  const ratio = maxPoints > 0 ? points / maxPoints : 0
  if (ratio >= 1) return "text-cyan-glow"
  if (ratio >= 0.5) return "text-amber-300"
  return "text-loss"
}

export function APlusScore({ scoring, confidence, compact = false, className }: APlusScoreProps) {
  const classification = scannerGradeToBadgeClassification(scoring.grade)

  return (
    <DashboardInsetPanel
      className={cn(
        "relative overflow-hidden border-white/[0.08] bg-black/20",
        compact ? "space-y-2.5 px-3 py-3" : "space-y-3.5 px-4 py-4",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-60",
          getSetupScoreGlowClass(classification),
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-cyan-glow" />
          <div>
            <p className="text-[10px] font-medium text-foreground/85">A+ Score</p>
            <p className="text-[10px] text-muted-foreground/70">
              {scoring.grade} · {getSetupClassificationLabel(classification)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SetupScoreBadge
            classification={classification}
            score={scoring.score}
            size="md"
            showScore
          />
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {scoring.score}/100
          </span>
        </div>
      </div>

      <div className="relative space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-muted-foreground/70">Signal confidence</span>
          <span className="font-semibold tabular-nums text-cyan-glow">{confidence}%</span>
        </div>
        <Progress value={scoring.score} className="h-2 bg-white/[0.06]" />
        <Progress value={confidence} className="h-1 bg-white/[0.04] [&>div]:bg-cyan-glow/70" />
      </div>

      <div className="relative space-y-2">
        <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/65">
          Why this score
        </p>
        <div className={cn("space-y-1.5", compact && "max-h-48 overflow-y-auto pr-1")}>
          {scoring.factors.map((factor) => (
            <div
              key={factor.id}
              className={cn(
                "rounded-lg border px-2.5 py-2",
                factor.met
                  ? "border-profit/15 bg-profit/[0.04]"
                  : factor.points > 0
                    ? "border-amber-400/15 bg-amber-400/[0.04]"
                    : "border-white/[0.06] bg-black/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium text-foreground/88">{factor.label}</p>
                <span
                  className={cn(
                    "text-[10px] font-bold tabular-nums",
                    factorTone(factor.points, factor.maxPoints),
                  )}
                >
                  +{factor.points}/{factor.maxPoints}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/75">
                {factor.reason}
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashboardInsetPanel>
  )
}
