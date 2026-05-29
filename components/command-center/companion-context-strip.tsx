"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import type { CommandCenterContext } from "@/lib/command-center/types"
import { cn } from "@/lib/utils"

type CompanionContextStripProps = {
  context: Pick<
    CommandCenterContext,
    | "cognitive"
    | "tradingOs"
    | "adaptiveCognition"
    | "vyronisCore"
    | "autonomous"
    | "freshWarnings"
    | "snapshot"
  >
  className?: string
}

function isFreshCompanionMorning(
  context: Pick<CommandCenterContext, "snapshot">,
): boolean {
  return (context.snapshot?.todayTradeCount ?? 0) === 0
}

type StripTone = "calm" | "insight" | "caution" | "protective"

type StripContent = {
  label: string
  headline: string
  detail?: string
  tone: StripTone
}

const TONE_STYLES: Record<StripTone, string> = {
  calm: "border-white/[0.08] bg-white/[0.03] text-foreground/88",
  insight: "border-violet-500/20 bg-violet-500/[0.05] text-violet-100/92",
  caution: "border-amber-500/25 bg-amber-500/[0.07] text-amber-100/92",
  protective: "border-rose-500/30 bg-rose-500/[0.08] text-rose-100/95",
}

function pickContextualStrip(
  context: CompanionContextStripProps["context"],
): StripContent | null {
  const os = context.tradingOs
  const core = context.vyronisCore
  const cog = context.cognitive
  const adaptive = context.adaptiveCognition
  const autonomous = context.autonomous
  const criticalWarning = context.freshWarnings.find((w) => w.severity === "critical")

  if (os?.intervention.active) {
    return {
      label: "Session guard",
      headline: os.intervention.headline,
      detail: os.intervention.canProceedToEntry
        ? os.intervention.message
        : `${os.intervention.message} Pause is discipline — reset, then re-engage when process is clear.`,
      tone: os.intervention.severity === "critical" ? "protective" : "caution",
    }
  }

  const freshMorning = isFreshCompanionMorning(context)

  if (criticalWarning) {
    return {
      label: "Risk note",
      headline: criticalWarning.message,
      tone: "caution",
    }
  }

  if (
    !freshMorning &&
    cog &&
    (cog.state.primary === "revenge_driven" ||
      cog.state.primary === "impulsive" ||
      cog.coaching.mode === "anti_revenge" ||
      cog.coaching.mode === "strict_funded_guardian")
  ) {
    return {
      label: "Trader state",
      headline: cog.coaching.headline,
      detail: cog.state.narrative,
      tone: "caution",
    }
  }

  const liveAlert = os?.liveSession.alerts.find(
    (a) => a.severity !== "info" && !(freshMorning && a.category === "emotional_drift"),
  )
  if (liveAlert) {
    return {
      label: "Live session",
      headline: liveAlert.message,
      detail: os?.proactiveHeadline,
      tone: liveAlert.severity === "critical" ? "protective" : "caution",
    }
  }

  const adaptiveInsight = adaptive?.insights[0]
  if (adaptiveInsight) {
    return {
      label: "Insight",
      headline: adaptiveInsight.message,
      tone: "insight",
    }
  }

  const shadow = autonomous?.shadow
  if (!freshMorning && shadow && shadow.emotionalRiskScore >= 72) {
    return {
      label: "Awareness",
      headline: shadow.proactiveMessage,
      tone: "caution",
    }
  }

  if (cog?.coaching.headline && cog.state.verdictStrictness >= 70) {
    return {
      label: "Coaching",
      headline: cog.coaching.headline,
      detail: cog.marketEnvironment.tradingBias,
      tone: "calm",
    }
  }

  return null
}

export function CompanionContextStrip({ context, className }: CompanionContextStripProps) {
  const strip = pickContextualStrip(context)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (strip?.tone === "protective") setExpanded(true)
  }, [strip?.tone])

  if (!strip) return null
  if (strip.tone === "calm" || strip.tone === "insight") return null

  const headline =
    strip.headline.length > 96 ? `${strip.headline.slice(0, 96).trim()}…` : strip.headline
  const showDetailToggle = strip.tone === "protective" && Boolean(strip.detail)

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border px-3 py-2 backdrop-blur-sm",
        TONE_STYLES[strip.tone],
        className,
      )}
    >
      <button
        type="button"
        onClick={() => showDetailToggle && setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-start gap-2 text-left",
          showDetailToggle ? "cursor-pointer" : "cursor-default",
        )}
      >
        <Sparkles className="mt-0.5 size-3.5 shrink-0 opacity-70" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[9px] font-medium uppercase tracking-[0.12em] opacity-60">
            {strip.label}
          </p>
          <p className="text-[11px] leading-snug">{headline}</p>
          {expanded && strip.detail ? (
            <p className="pt-1 text-[10px] leading-relaxed opacity-85">{strip.detail}</p>
          ) : null}
        </div>
        {showDetailToggle ? (
          expanded ? (
            <ChevronUp className="size-3.5 shrink-0 opacity-50" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 opacity-50" />
          )
        ) : null}
      </button>
    </div>
  )
}
