"use client"

import { useMemo } from "react"
import { AlertTriangle, ArrowRight, ClipboardList } from "lucide-react"
import type { CoachExecutionVerdict } from "@/lib/coach/coach-execution-verdict"
import {
  buildCoachDecisionView,
  type CoachPrimaryAction,
} from "@/lib/coach/coach-decision-view"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { VyronisCoachResponse } from "@/lib/coach/vyronis-coach-response"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

type CoachDecisionPanelProps = {
  verdict: CoachExecutionVerdict
  mtf?: MtfAnalysisResult | null
  context?: PreTradePlannedContext | null
  vyronisCoach?: VyronisCoachResponse | null
  className?: string
}

function primaryActionTone(action: CoachPrimaryAction) {
  if (action === "TAKE") return "border-profit/40 bg-profit/[0.14] text-profit"
  if (action === "WAIT") return "border-warning/40 bg-warning/[0.12] text-warning-foreground"
  return "border-loss/40 bg-loss/[0.12] text-loss"
}

function PassFailBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
        passed
          ? "border-profit/30 bg-profit/[0.12] text-profit"
          : "border-loss/30 bg-loss/[0.1] text-loss",
      )}
    >
      {passed ? "Pass" : "Fail"}
    </span>
  )
}

export function CoachDecisionPanel({
  verdict,
  mtf,
  context,
  vyronisCoach,
  className,
}: CoachDecisionPanelProps) {
  const view = useMemo(
    () =>
      buildCoachDecisionView({
        verdict,
        mtf,
        context,
        vyronisCoach,
      }),
    [verdict, mtf, context, vyronisCoach],
  )

  return (
    <div className={cn("space-y-2.5", className)}>
      <div
        className={cn(
          "rounded-xl border px-4 py-4 sm:px-5 sm:py-4",
          primaryActionTone(view.primaryAction),
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">
          Final Verdict
        </p>
        <p className="mt-1 text-[22px] font-bold leading-none tracking-tight sm:text-[26px]">
          {view.primaryAction}
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
          Setup Score
        </p>
        <p className="mt-1 text-[20px] font-bold tabular-nums text-foreground/95">
          {view.setupScore}
          <span className="text-[14px] font-medium text-muted-foreground/70">/100</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/75">{view.setupGrade} setup grade</p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-3.5 text-cyan-glow" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
            Decision Factors
          </p>
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {view.decisionFactors.map((factor) => (
            <li
              key={factor.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-foreground/92">{factor.label}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/75">
                  {factor.value}
                </p>
              </div>
              <PassFailBadge passed={factor.passed} />
            </li>
          ))}
        </ul>
      </div>

      {view.failedRules.length > 0 ? (
        <div className="rounded-xl border border-warning/25 bg-warning/[0.05] px-3 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning-foreground/90">
            <AlertTriangle className="size-3" />
            Failed Rules
          </p>
          <ul className="mt-2 space-y-2">
            {view.failedRules.map((rule) => (
              <li key={`${rule.label}-${rule.explanation}`} className="text-[11px] leading-relaxed">
                <span className="font-semibold text-foreground/92">{rule.label}:</span>{" "}
                <span className="text-foreground/85">{rule.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-cyan-glow/20 bg-cyan-glow/[0.06] px-3 py-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/90">
          <ArrowRight className="size-3" />
          Next Action
        </p>
        <p className="mt-2 text-[12px] font-medium leading-relaxed text-foreground/92">
          {view.nextAction}
        </p>
      </div>

    </div>
  )
}
