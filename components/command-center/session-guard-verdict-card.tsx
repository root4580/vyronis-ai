"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { VerdictReasoning } from "@/lib/intelligence/verdict-reasoning-engine"
import {
  deriveTraderFinalAction,
  TRADER_FINAL_ACTION_STYLES,
} from "@/lib/intelligence/final-action-display"
import { SetupGradeBadge } from "@/components/command-center/setup-grade-badge"
import { gradeFromTechnicalScore } from "@/lib/intelligence/setup-grade-display"
import { cn } from "@/lib/utils"

function ScorePill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5 text-center">
      <p className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground/55">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-foreground/90">{value}</p>
    </div>
  )
}

export function SessionGuardVerdictCard({ reasoning }: { reasoning: VerdictReasoning }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const finalAction = deriveTraderFinalAction(reasoning)
  const setupGrade = gradeFromTechnicalScore(reasoning.technicalSetupScore)

  return (
    <div className="session-guard-verdict-card mt-2 space-y-2 rounded-xl border border-white/[0.08] bg-black/35 p-2.5 sm:p-3">
      <div
        className={cn(
          "rounded-xl border px-3 py-3 sm:px-4 sm:py-4",
          TRADER_FINAL_ACTION_STYLES[finalAction.tone],
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-75">
            Final action
          </p>
          <SetupGradeBadge grade={setupGrade} size="md" />
        </div>
        <p className="mt-1 text-[26px] font-bold leading-none tracking-tight sm:text-[32px]">
          {finalAction.action}
        </p>
        <p className="mt-2 text-[11px] leading-snug opacity-90">{finalAction.subline}</p>
        {reasoning.dominantDecidingFactor ? (
          <p className="mt-2 text-[10px] leading-snug opacity-75">
            {reasoning.dominantDecidingFactor}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <ScorePill label="Setup" value={reasoning.technicalSetupScore} />
        <ScorePill label="State" value={reasoning.traderStateScore} />
        <ScorePill label="Risk" value={reasoning.executionRiskLevel} />
        <ScorePill label="Verdict" value={reasoning.verdict} />
      </div>

      <p className="line-clamp-2 text-[11px] leading-snug text-foreground/80">
        {reasoning.coachHeadline}
      </p>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground/60 hover:text-foreground/80"
      >
        {detailsOpen ? "Hide layers" : "Layers & detail"}
        {detailsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {detailsOpen ? (
        <div className="space-y-2 border-t border-white/[0.05] pt-2 text-[10px] leading-relaxed text-foreground/75">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground/55">Technical</p>
              <p className="font-medium">{reasoning.technicalLayerLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground/55">Trader</p>
              <p className="font-medium">{reasoning.traderLayerLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground/55">Best action</p>
              <p className="font-medium text-cyan-glow/90">{reasoning.bestAction}</p>
            </div>
            <div>
              <p className="text-muted-foreground/55">Label</p>
              <p className="font-medium">{reasoning.finalActionLabel}</p>
            </div>
          </div>
          {reasoning.whatWouldMakeTradable.length > 0 ? (
            <ul className="space-y-0.5">
              {reasoning.whatWouldMakeTradable.slice(0, 3).map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span className="text-cyan-glow/50">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {reasoning.confidenceExplanation ? (
            <p className="text-foreground/70">{reasoning.confidenceExplanation}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
