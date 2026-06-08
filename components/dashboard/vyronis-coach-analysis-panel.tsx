"use client"

import type { CoachExecutionVerdict } from "@/lib/coach/coach-execution-verdict"
import type { VyronisCoachResponse } from "@/lib/coach/vyronis-coach-response"
import { CoachExecutionVerdictPanel } from "@/components/dashboard/coach-execution-verdict-panel"
import { cn } from "@/lib/utils"

type VyronisCoachAnalysisPanelProps = {
  coach: VyronisCoachResponse
  executionVerdict?: CoachExecutionVerdict | null
  className?: string
}

export function VyronisCoachAnalysisPanel({
  coach,
  executionVerdict,
  className,
}: VyronisCoachAnalysisPanelProps) {
  if (!executionVerdict && !coach.execution_verdict) return null
  const resolvedVerdict = executionVerdict ?? coach.execution_verdict!

  return (
    <div className={cn("space-y-3", className)}>
      <CoachExecutionVerdictPanel verdict={resolvedVerdict} />

      <div className="grid grid-cols-3 gap-2 text-center text-[10px] tabular-nums">
        <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-2">
          <p className="text-muted-foreground/60">Setup</p>
          <p className="mt-0.5 font-semibold text-foreground/90">{coach.setup_score}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-2">
          <p className="text-muted-foreground/60">State</p>
          <p className="mt-0.5 font-semibold text-foreground/90">{coach.state_score}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-2">
          <p className="text-muted-foreground/60">Risk</p>
          <p
            className={cn(
              "mt-0.5 font-semibold",
              coach.risk_level === "HIGH"
                ? "text-loss"
                : coach.risk_level === "MEDIUM"
                  ? "text-warning-foreground"
                  : "text-profit",
            )}
          >
            {coach.risk_level}
          </p>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-foreground/90">{coach.summary}</p>

      {coach.journal_cross_reference ? (
        <div className="rounded-lg border border-cyan-glow/20 bg-cyan-glow/[0.06] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/80">
            Journal memory
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">
            {coach.journal_cross_reference}
          </p>
        </div>
      ) : null}

      {coach.warnings.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
            Warnings
          </p>
          <ul className="space-y-1">
            {coach.warnings.map((warning) => (
              <li
                key={warning}
                className="text-[11px] leading-relaxed text-warning-muted/90 before:mr-1.5 before:content-['·']"
              >
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
          One improvement
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground/88">{coach.one_improvement}</p>
      </div>
    </div>
  )
}
