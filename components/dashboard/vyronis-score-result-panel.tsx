"use client"

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { VyronisGradeBadge } from "@/components/dashboard/vyronis-grade-badge"
import type { VyronisJournalEvaluationRecord } from "@/lib/strategy/vyronis-journal-bridge"
import { VYRONIS_CORE_MODEL, VYRONIS_STRATEGY_SCORING } from "@/types/vyronis-branding"
import { cn } from "@/lib/utils"

type VyronisScoreResultPanelProps = {
  evaluation: VyronisJournalEvaluationRecord
  compact?: boolean
  className?: string
  /** When true, labels reflect a completed trade review instead of pre-entry guidance. */
  isClosedTrade?: boolean
}

export function VyronisScoreResultPanel({
  evaluation,
  compact = false,
  className,
  isClosedTrade = false,
}: VyronisScoreResultPanelProps) {
  const passed = !evaluation.hardSkip && evaluation.grade !== "Skip"
  const verdictText = isClosedTrade
    ? evaluation.postTradeVerdict ??
      (passed
        ? "Closed trade with acceptable doctrine alignment."
        : "Closed trade with doctrine or discipline gaps to review.")
    : evaluation.recommendation.replace("_", " ")

  return (
    <DashboardInsetPanel
      className={cn(
        "space-y-3 border-cyan-glow/20 bg-cyan-glow/[0.04]",
        evaluation.hardSkip && "border-loss/25 bg-loss/[0.04]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/85">
            <Sparkles className="size-3.5" />
            {VYRONIS_CORE_MODEL}
          </p>
          <p className="text-[11px] text-muted-foreground/75">{VYRONIS_STRATEGY_SCORING}</p>
        </div>
        <div className="text-right">
          <VyronisGradeBadge grade={evaluation.grade} score={evaluation.score} size={compact ? "md" : "lg"} />
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">Score {evaluation.score}/100</p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border px-3 py-2 text-[12px]",
          passed
            ? "border-profit/25 bg-profit/[0.06] text-foreground/90"
            : "border-loss/25 bg-loss/[0.06] text-foreground/90",
        )}
      >
        <p className="flex items-center gap-1.5 font-medium">
          {passed ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-profit" />
          ) : (
            <AlertTriangle className="size-3.5 shrink-0 text-loss" />
          )}
          {isClosedTrade ? "Post-trade verdict" : "Recommendation"}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/88">
          {isClosedTrade ? verdictText : null}
          {!isClosedTrade ? (
            <span className="uppercase">{evaluation.recommendation.replace("_", " ")}</span>
          ) : null}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/85">
          {isClosedTrade
            ? evaluation.improvement
            : passed
              ? evaluation.passSummary
              : evaluation.failSummary}
        </p>
      </div>

      {!compact && evaluation.reasons.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-profit/80">Why it passed</p>
          <ul className="space-y-1">
            {evaluation.reasons.slice(0, 4).map((reason) => (
              <li key={reason} className="text-[11px] leading-snug text-foreground/85">
                · {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.warnings.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/80">Warnings</p>
          <ul className="space-y-1">
            {evaluation.warnings.slice(0, 4).map((warning) => (
              <li key={warning} className="text-[11px] leading-snug text-warning-muted/90">
                · {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.mainMistake && (
        <div className="rounded-lg border border-loss/20 bg-loss/[0.05] px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-loss/80">Main mistake</p>
          <p className="mt-1 text-[11px] text-foreground/85">{evaluation.mainMistake}</p>
        </div>
      )}

      {evaluation.improvement && (
        <div className="rounded-lg border border-cyan-glow/20 bg-cyan-glow/[0.05] px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-glow/80">
            One improvement next trade
          </p>
          <p className="mt-1 text-[11px] text-foreground/85">{evaluation.improvement}</p>
        </div>
      )}

      {evaluation.rrBelowMinimum && (
        <p className="flex items-center gap-1.5 text-[11px] text-warning-foreground">
          <AlertTriangle className="size-3.5 shrink-0" />
          {isClosedTrade
            ? "R:R below 1:2 on this closed trade — review asymmetry before repeating the setup."
            : "R:R below 1:2 — Vyronis warns before you size up."}
        </p>
      )}
    </DashboardInsetPanel>
  )
}
