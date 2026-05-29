"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { AoiStatus, SetupGrade, TradeRecommendation } from "@/lib/strategy-brain/types"

export function StrategyBrainGlass({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-gradient-to-br from-black/50 via-black/35 to-cyan-glow/[0.04] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-glow/75">
      {children}
    </p>
  )
}

export function GradeBadge({ grade }: { grade: SetupGrade }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums tracking-wide",
        grade === "A+" && "bg-profit/20 text-profit",
        grade === "B" && "bg-cyan-glow/15 text-cyan-glow",
        grade === "C" && "bg-amber-500/15 text-amber-200",
        grade === "D" && "bg-loss/15 text-loss",
      )}
    >
      {grade}
    </span>
  )
}

export function RecommendationBadge({ rec }: { rec: TradeRecommendation }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        rec === "TAKE" && "bg-profit/15 text-profit",
        rec === "CAUTION" && "bg-amber-500/15 text-amber-200",
        rec === "SKIP" && "bg-white/10 text-muted-foreground",
      )}
    >
      {rec}
    </span>
  )
}

export function AoiStatusPill({ status }: { status: AoiStatus }) {
  const styles: Record<AoiStatus, string> = {
    WAITING: "bg-white/8 text-muted-foreground",
    INSIDE_AOI: "bg-cyan-glow/15 text-cyan-glow",
    CONFIRMING: "bg-violet-500/15 text-violet-200",
    INVALIDATED: "bg-loss/15 text-loss",
  }
  const labels: Record<AoiStatus, string> = {
    WAITING: "Waiting",
    INSIDE_AOI: "Inside AOI",
    CONFIRMING: "Confirming",
    INVALIDATED: "Invalidated",
  }
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", styles[status])}>
      {labels[status]}
    </span>
  )
}

export function BiasToggle({
  value,
  onChange,
  label,
}: {
  value: import("@/lib/strategy-brain/types").BiasDirection
  onChange: (v: import("@/lib/strategy-brain/types").BiasDirection) => void
  label: string
}) {
  const options: import("@/lib/strategy-brain/types").BiasDirection[] = [
    "Bullish",
    "Bearish",
    "Neutral",
  ]
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground/70">{label}</p>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "flex-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-all duration-200",
              value === opt
                ? opt === "Bullish"
                  ? "border-profit/40 bg-profit/15 text-profit"
                  : opt === "Bearish"
                    ? "border-loss/40 bg-loss/15 text-loss"
                    : "border-white/20 bg-white/10 text-foreground"
                : "border-white/[0.06] bg-black/20 text-muted-foreground hover:border-white/12",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
