"use client"

import { AlertTriangle, BookOpen, CheckCircle2, Clock, Shield, Target } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { StrategyPlaybookMatchResult } from "@/lib/strategy/types"
import { cn } from "@/lib/utils"

type StrategyPlaybookMatchPanelProps = {
  match: StrategyPlaybookMatchResult
  compact?: boolean
}

function scoreColor(score: number) {
  if (score >= 75) return "text-profit"
  if (score >= 55) return "text-warning-foreground"
  return "text-loss"
}

function recommendationColor(recommendation: StrategyPlaybookMatchResult["recommendation"]) {
  if (recommendation === "TAKE") return "text-profit"
  if (recommendation === "CAUTION") return "text-warning-foreground"
  return "text-loss"
}

function ScoreTile({
  label,
  score,
  icon: Icon,
}: {
  label: string
  score: number
  icon: typeof Target
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] text-muted-foreground/65">
        <Icon className="size-3" />
        {label}
      </p>
      <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", scoreColor(score))}>
        {score}/100
      </p>
      <Progress value={score} className="mt-1.5 h-1 bg-white/[0.06]" />
    </div>
  )
}

export function StrategyPlaybookMatchPanel({
  match,
  compact = false,
}: StrategyPlaybookMatchPanelProps) {
  const setupQuality = match.setupQualityScore ?? match.matchScore
  const ruleAdherence = match.ruleAdherenceScore ?? match.matchScore
  const executionTiming = match.executionTimingScore ?? match.matchScore

  const detections = [
    match.detections?.htfConflict ? "HTF conflict" : null,
    match.detections?.earlyEntry ? "Early entry" : null,
    match.detections?.beforeConfirmationClose ? "Before confirmation close" : null,
    match.detections?.fomoEntry ? "FOMO pattern" : null,
    match.detections?.revengeEntry ? "Revenge pattern" : null,
    match.detections?.overextendedEntry ? "Overextended / chase" : null,
    match.detections?.noLiquidityConfirmation ? "No liquidity confirmation" : null,
  ].filter(Boolean) as string[]

  return (
    <DashboardInsetPanel className="space-y-3 border-purple-400/15 bg-purple-400/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="size-3.5 text-purple-300" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/85">
            Strategy Playbook Match
          </p>
        </div>
        <span className={cn("text-lg font-bold tabular-nums", scoreColor(match.matchScore))}>
          {match.matchScore}/100
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-foreground/85">
          {match.strategyName}
        </span>
        <span className="rounded-md border border-cyan-glow/20 bg-cyan-glow/[0.06] px-2 py-0.5 text-[10px] font-semibold text-cyan-glow">
          Grade {match.setupGrade}
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
            recommendationColor(match.recommendation),
            match.recommendation === "TAKE"
              ? "border-profit/25 bg-profit/[0.08]"
              : match.recommendation === "CAUTION"
                ? "border-warning/25 bg-warning/[0.08]"
                : "border-loss/25 bg-loss/[0.08]",
          )}
        >
          Final: {match.recommendation}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ScoreTile label="Setup Quality" score={setupQuality} icon={Target} />
        <ScoreTile label="Rule Adherence" score={ruleAdherence} icon={Shield} />
        <ScoreTile label="Execution Timing" score={executionTiming} icon={Clock} />
      </div>

      {!compact && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">{match.summary}</p>
      )}

      {detections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {detections.slice(0, compact ? 3 : 5).map((item) => (
            <span
              key={item}
              className="rounded-md border border-warning/20 bg-warning/[0.08] px-2 py-0.5 text-[9px] text-warning-muted/90"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-profit/15 bg-profit/[0.04] px-2 py-1.5">
          <p className="flex items-center gap-1 text-profit/80">
            <CheckCircle2 className="size-3" />
            Rules Passed ({match.rulesPassed.length})
          </p>
          {match.rulesPassed.length === 0 ? (
            <p className="mt-1 text-muted-foreground/65">None yet</p>
          ) : (
            match.rulesPassed.slice(0, compact ? 2 : 4).map((rule) => (
              <p key={rule} className="mt-1 text-foreground/80">
                {rule}
              </p>
            ))
          )}
        </div>

        <div className="rounded-lg border border-loss/15 bg-loss/[0.04] px-2 py-1.5">
          <p className="flex items-center gap-1 text-loss/80">
            <AlertTriangle className="size-3" />
            Rules Failed ({match.rulesFailed.length})
          </p>
          {match.rulesFailed.length === 0 ? (
            <p className="mt-1 text-muted-foreground/65">None</p>
          ) : (
            match.rulesFailed.slice(0, compact ? 2 : 4).map((rule) => (
              <p key={rule} className="mt-1 text-foreground/80">
                {rule}
              </p>
            ))
          )}
        </div>
      </div>

      {match.missingConfirmations.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/80">
            Missing Confirmations
          </p>
          {match.missingConfirmations.slice(0, compact ? 2 : 4).map((item) => (
            <p key={item} className="text-[10px] text-warning-muted/85">
              {item}
            </p>
          ))}
        </div>
      )}

      {match.violations.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-loss/80">
            Rule Violations
          </p>
          {match.violations.slice(0, compact ? 2 : 4).map((item) => (
            <p key={item} className="text-[10px] text-loss/90">
              {item}
            </p>
          ))}
        </div>
      )}
    </DashboardInsetPanel>
  )
}
