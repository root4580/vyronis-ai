"use client"

import { AlertTriangle, CheckCircle2, Target, Timer } from "lucide-react"
import type { CoachExecutionVerdict } from "@/lib/coach/coach-execution-verdict"
import { cn } from "@/lib/utils"

type CoachExecutionVerdictPanelProps = {
  verdict: CoachExecutionVerdict
  className?: string
  compact?: boolean
}

function finalVerdictTone(verdict: CoachExecutionVerdict["finalVerdict"]) {
  if (verdict === "A_PLUS_READY") return "border-profit/30 bg-profit/[0.1] text-profit"
  if (verdict === "WAIT_FOR_CONFIRMATION") {
    return "border-warning/30 bg-warning/[0.1] text-warning-foreground"
  }
  return "border-loss/30 bg-loss/[0.1] text-loss"
}

function setupGradeTone(grade: string) {
  if (grade === "A+" || grade === "A") return "text-profit"
  if (grade === "B") return "text-cyan-glow"
  if (grade === "C") return "text-warning-foreground"
  return "text-loss"
}

export function CoachExecutionVerdictPanel({
  verdict,
  className,
  compact = false,
}: CoachExecutionVerdictPanelProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
          <div className="flex items-center gap-2">
            <Target className="size-3.5 text-cyan-glow" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              Setup Quality
            </p>
          </div>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums", setupGradeTone(verdict.setupQuality.grade))}>
            {verdict.setupQuality.grade}{" "}
            <span className="text-base font-semibold text-foreground/75">
              ({verdict.setupQuality.score}/100)
            </span>
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/85">
            {verdict.setupQuality.summary}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
          <div className="flex items-center gap-2">
            <Timer className="size-3.5 text-warning-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              Entry Readiness
            </p>
          </div>
          <p
            className={cn(
              "mt-2 text-[13px] font-bold uppercase tracking-[0.08em]",
              verdict.entryReadiness.status === "READY"
                ? "text-profit"
                : verdict.entryReadiness.status === "WAIT_FOR_CONFIRMATION"
                  ? "text-warning-foreground"
                  : "text-loss",
            )}
          >
            {verdict.entryReadiness.headline}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/85">
            {verdict.entryReadiness.summary}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border px-3 py-3",
          finalVerdictTone(verdict.finalVerdict),
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          Final Verdict
        </p>
        <p className="mt-1 text-[15px] font-bold tracking-tight">{verdict.finalVerdictLabel}</p>
        <p className="mt-2 text-[11px] leading-relaxed opacity-95">{verdict.mentorLine}</p>
      </div>

      {!compact && (verdict.reasons.strengths.length > 0 || verdict.reasons.blockers.length > 0) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {verdict.reasons.strengths.length > 0 ? (
            <div className="rounded-lg border border-profit/15 bg-profit/[0.04] px-3 py-2.5">
              <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-profit/85">
                <CheckCircle2 className="size-3" />
                What checks out
              </p>
              <ul className="mt-1.5 space-y-1">
                {verdict.reasons.strengths.map((item) => (
                  <li key={item} className="text-[10px] leading-relaxed text-foreground/85">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {verdict.reasons.blockers.length > 0 ? (
            <div className="rounded-lg border border-warning/15 bg-warning/[0.04] px-3 py-2.5">
              <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/85">
                <AlertTriangle className="size-3" />
                {verdict.finalVerdict === "SKIP_TRADE" ? "Why skip" : "Still waiting for"}
              </p>
              <ul className="mt-1.5 space-y-1">
                {verdict.reasons.blockers.map((item) => (
                  <li key={item} className="text-[10px] leading-relaxed text-foreground/85">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
