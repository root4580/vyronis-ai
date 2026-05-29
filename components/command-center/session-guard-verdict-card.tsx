"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Shield } from "lucide-react"
import type { VerdictReasoning } from "@/lib/intelligence/verdict-reasoning-engine"
import { cn } from "@/lib/utils"

function LayerRow({
  label,
  value,
  score,
  tone,
}: {
  label: string
  value: string
  score: number
  tone: "good" | "warn" | "bad" | "neutral"
}) {
  const boxClass =
    tone === "good"
      ? "border-profit/25 bg-profit/[0.08]"
      : tone === "bad"
        ? "border-loss/25 bg-loss/[0.08]"
        : tone === "warn"
          ? "border-amber-500/25 bg-amber-500/[0.08]"
          : "border-white/10 bg-white/[0.03]"
  const textClass =
    tone === "good"
      ? "text-profit"
      : tone === "bad"
        ? "text-loss"
        : tone === "warn"
          ? "text-amber-200"
          : "text-foreground/85"

  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2", boxClass)}>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">{label}</p>
        <p className={cn("text-[12px] font-semibold tracking-wide", textClass)}>{value}</p>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">{score}/100</span>
    </div>
  )
}

function layerTone(label: string): "good" | "warn" | "bad" | "neutral" {
  if (label === "GOOD" || label === "STABLE") return "good"
  if (label === "COMPROMISED" || label === "WEAK") return "bad"
  if (label === "ELEVATED" || label === "FAIR") return "warn"
  return "neutral"
}

function riskTone(level: string): "good" | "warn" | "bad" {
  if (level === "LOW") return "good"
  if (level === "HIGH") return "bad"
  return "warn"
}

export function SessionGuardVerdictCard({ reasoning }: { reasoning: VerdictReasoning }) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-white/[0.08] bg-gradient-to-br from-black/40 via-black/25 to-cyan-glow/[0.03] p-3 sm:p-3.5">
      <div className="flex items-start gap-2">
        <Shield className="mt-0.5 size-4 shrink-0 text-cyan-glow/80" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-cyan-glow/70">
            Session guard
          </p>
          <p className="text-[12px] leading-snug text-foreground/92">{reasoning.coachHeadline}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-2 text-[10px] sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground/55">Technical</p>
          <p className="font-semibold tabular-nums text-foreground/90">
            {reasoning.technicalSetupScore}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground/55">Psychology</p>
          <p className="font-semibold tabular-nums text-foreground/90">
            {reasoning.traderStateScore}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground/55">Exec. risk</p>
          <p
            className={cn(
              "font-semibold uppercase tracking-wide",
              reasoning.executionRiskLevel === "HIGH" && "text-loss",
              reasoning.executionRiskLevel === "MEDIUM" && "text-amber-200",
              reasoning.executionRiskLevel === "LOW" && "text-profit",
            )}
          >
            {reasoning.executionRiskLevel}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-muted-foreground/55">Best action</p>
          <p className="text-[10px] font-semibold leading-tight text-cyan-glow/90">
            {reasoning.bestAction}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <LayerRow
          label="Technical setup"
          value={reasoning.technicalLayerLabel}
          score={reasoning.technicalSetupScore}
          tone={layerTone(reasoning.technicalLayerLabel)}
        />
        <LayerRow
          label="Trader state"
          value={reasoning.traderLayerLabel}
          score={reasoning.traderStateScore}
          tone={layerTone(reasoning.traderLayerLabel)}
        />
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2",
          riskTone(reasoning.executionRiskLevel) === "bad"
            ? "border-loss/30 bg-loss/[0.06]"
            : riskTone(reasoning.executionRiskLevel) === "warn"
              ? "border-amber-500/25 bg-amber-500/[0.06]"
              : "border-profit/25 bg-profit/[0.06]",
        )}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/65">
          Final action
        </p>
        <p className="text-[13px] font-bold uppercase tracking-wide text-foreground/95">
          {reasoning.finalActionLabel}
        </p>
      </div>

      {reasoning.emotionalConfidence ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">
            Emotional confidence · {reasoning.emotionalConfidence}
            {reasoning.sessionRecoveryPhase
              ? ` · ${reasoning.sessionRecoveryPhase.replace(/_/g, " ")}`
              : ""}
          </p>
          {reasoning.emotionalConfidenceReasons &&
          reasoning.emotionalConfidenceReasons.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-foreground/78">
              {reasoning.emotionalConfidenceReasons.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span className="text-muted-foreground/45">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {reasoning.confidenceExplanation ? (
        <p className="text-[11px] leading-relaxed text-foreground/82">
          {reasoning.confidenceExplanation}
        </p>
      ) : null}

      {reasoning.historicalPatternMemory ? (
        <p className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-violet-100/88">
          {reasoning.historicalPatternMemory}
        </p>
      ) : null}

      {reasoning.whatWouldMakeTradable.length > 0 ? (
        <div className="rounded-lg border border-cyan-glow/15 bg-cyan-glow/[0.04] px-2.5 py-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-glow/75">
            What would make this tradable?
          </p>
          <ul className="space-y-1 text-[11px] leading-relaxed text-foreground/85">
            {reasoning.whatWouldMakeTradable.map((line) => (
              <li key={line} className="flex gap-1.5">
                <span className="text-cyan-glow/60">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground/60 hover:text-foreground/80"
      >
        {detailsOpen ? "Less detail" : "More detail"}
        {detailsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {detailsOpen ? (
        <div className="space-y-2 border-t border-white/[0.05] pt-2 text-[11px] leading-relaxed text-foreground/78">
          <p>{reasoning.finalDecisionExplanation}</p>
          {reasoning.psychologyClarification ? (
            <p className="text-amber-100/85">{reasoning.psychologyClarification}</p>
          ) : null}
          {reasoning.verdict !== "TAKE" && reasoning.whyNotTake.length > 0 ? (
            <ul className="space-y-1">
              {reasoning.whyNotTake.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span className="text-muted-foreground/50">—</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
