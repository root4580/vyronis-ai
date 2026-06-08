"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck } from "lucide-react"
import { CoachSessionGateDebug } from "@/components/dashboard/coach-session-gate-debug"
import type { CoachExecutionVerdict } from "@/lib/coach/coach-execution-verdict"
import { cn } from "@/lib/utils"

type CoachExecutionVerdictPanelProps = {
  verdict: CoachExecutionVerdict
  className?: string
  compact?: boolean
}

function finalVerdictTone(verdict: CoachExecutionVerdict["finalVerdict"]) {
  if (verdict === "A_PLUS_READY") return "border-profit/35 bg-profit/[0.12] text-profit"
  if (verdict === "WAIT_FOR_CONFIRMATION" || verdict === "COACH_WARNING") {
    return "border-warning/35 bg-warning/[0.1] text-warning-foreground"
  }
  return "border-loss/35 bg-loss/[0.1] text-loss"
}

function setupGradeTone(grade: string) {
  if (grade === "A+" || grade === "A") return "text-profit"
  if (grade === "B") return "text-cyan-glow"
  if (grade === "C") return "text-warning-foreground"
  return "text-loss"
}

function RuleStatusIcon({ passed }: { passed: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.25rem] justify-center text-[12px] font-bold",
        passed ? "text-profit" : "text-loss",
      )}
      aria-hidden
    >
      {passed ? "✅" : "❌"}
    </span>
  )
}

export function CoachExecutionVerdictPanel({
  verdict,
  className,
  compact = false,
}: CoachExecutionVerdictPanelProps) {
  const { entryGate } = verdict
  const [debugOpen, setDebugOpen] = useState(false)
  const hasReasons =
    verdict.reasons.strengths.length > 0 || verdict.reasons.blockers.length > 0
  const ruleNotes = entryGate.rules.filter((rule) => rule.note)
  const hasDebug = Boolean(entryGate.sessionDebug) || ruleNotes.length > 0

  const whyTitle =
    verdict.reasons.blockers.length > 0
      ? verdict.finalVerdict === "SKIP_TRADE"
        ? "Why skip"
        : "Why blocked"
      : verdict.reasons.strengths.length > 0
        ? "Why ready"
        : null

  return (
    <div className={cn("space-y-2.5", className)}>
      <div
        className={cn(
          "rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5",
          finalVerdictTone(verdict.finalVerdict),
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
          Final Verdict
        </p>
        <p className="mt-1 text-[18px] font-bold leading-tight tracking-tight sm:text-[20px]">
          {verdict.finalVerdictLabel}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium tabular-nums opacity-95">
          <span className={setupGradeTone(verdict.setupQuality.grade)}>
            {verdict.setupQuality.grade} Setup ({verdict.setupQuality.score}/100)
          </span>
          <span className="opacity-50">·</span>
          <span>{entryGate.progressLabel}</span>
          <span className="opacity-50">·</span>
          <span
            className={cn(
              "font-semibold uppercase tracking-[0.06em]",
              entryGate.entryStatus === "READY" ? "text-profit" : "text-warning-foreground",
            )}
          >
            Entry {entryGate.entryStatus === "READY" ? "ready" : "wait"}
          </span>
        </p>
        <p className="mt-2.5 text-[12px] font-medium leading-relaxed opacity-95">
          {verdict.mentorLine}
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-3.5 text-cyan-glow" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              Entry Gate
            </p>
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-foreground/85">
            {entryGate.progressLabel}
          </span>
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {entryGate.rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center gap-2 text-[11px] leading-snug text-foreground/88"
            >
              <RuleStatusIcon passed={rule.passed} />
              <span className="min-w-0 flex-1 font-medium">{rule.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {!compact && hasReasons && whyTitle ? (
        <div
          className={cn(
            "rounded-xl border px-3 py-3",
            verdict.reasons.blockers.length > 0
              ? "border-warning/20 bg-warning/[0.04]"
              : "border-profit/20 bg-profit/[0.04]",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
              verdict.reasons.blockers.length > 0
                ? "text-warning-foreground/90"
                : "text-profit/90",
            )}
          >
            {verdict.reasons.blockers.length > 0 ? (
              <AlertTriangle className="size-3" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            {whyTitle}
          </p>
          <ul className="mt-2 space-y-1">
            {(verdict.reasons.blockers.length > 0
              ? verdict.reasons.blockers
              : verdict.reasons.strengths
            ).map((item) => (
              <li key={item} className="text-[11px] leading-relaxed text-foreground/88">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && hasDebug ? (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/10">
          <button
            type="button"
            onClick={() => setDebugOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/65">
              Debug information
            </p>
            {debugOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground/70" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground/70" />
            )}
          </button>
          {debugOpen ? (
            <div className="space-y-2.5 border-t border-white/[0.06] px-3 py-3">
              <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
                  Setup quality detail
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">
                  {verdict.setupQuality.summary}
                </p>
              </div>
              {ruleNotes.length > 0 ? (
                <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
                    Rule notes
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {ruleNotes.map((rule) => (
                      <li key={rule.id} className="text-[10px] leading-relaxed text-foreground/80">
                        <span className="font-medium">{rule.label}:</span> {rule.note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {entryGate.sessionDebug ? (
                <CoachSessionGateDebug debug={entryGate.sessionDebug} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
