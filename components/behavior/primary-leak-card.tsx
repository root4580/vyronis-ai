"use client"

import { useMemo } from "react"
import { Target } from "lucide-react"
import {
  detectPrimaryLeak,
  formatLeakEvidenceLine,
  LEAK_ENGINE_DEFAULTS,
  type LeakEngineInput,
  type PrimaryLeakInsight,
} from "@/lib/behavior"
import { DEFAULT_USER_SETTINGS, type UserSettingsForm } from "@/lib/user-settings"
import { cn } from "@/lib/utils"

type PrimaryLeakCardTrade = LeakEngineInput["trades"][number]

type PrimaryLeakCardProps = {
  trades: PrimaryLeakCardTrade[]
  maxRiskPerTrade?: number
  lookbackDays?: number
  className?: string
}

function statusStyles(insight: PrimaryLeakInsight) {
  if (insight.status === "active") {
    return {
      border: "border-cyan-glow/22",
      glow: "from-cyan-glow/12 via-transparent to-transparent",
      accent: "text-cyan-glow",
      pill: "border-cyan-glow/30 bg-cyan-glow/10 text-cyan-glow",
    }
  }
  if (insight.status === "low_confidence") {
    return {
      border: "border-amber-500/20",
      glow: "from-amber-500/10 via-transparent to-transparent",
      accent: "text-amber-200/90",
      pill: "border-amber-500/28 bg-amber-500/10 text-amber-100/90",
    }
  }
  return {
    border: "border-white/[0.08]",
    glow: "from-white/[0.03] via-transparent to-transparent",
    accent: "text-muted-foreground/80",
    pill: "border-white/[0.1] bg-white/[0.04] text-muted-foreground/75",
  }
}

function confidenceLabel(insight: PrimaryLeakInsight): string {
  if (insight.status === "insufficient_data") return "Building profile"
  if (insight.confidence <= 0) return "Needs more trades"
  return `${insight.confidence}% confidence`
}

export function PrimaryLeakCard({
  trades,
  maxRiskPerTrade = DEFAULT_USER_SETTINGS.max_risk_per_trade,
  lookbackDays = LEAK_ENGINE_DEFAULTS.lookbackDays,
  className,
}: PrimaryLeakCardProps) {
  const insight = useMemo(
    () =>
      detectPrimaryLeak({
        trades,
        maxRiskPerTrade,
        lookbackDays,
      }),
    [trades, maxRiskPerTrade, lookbackDays],
  )

  const styles = statusStyles(insight)
  const evidenceLine = formatLeakEvidenceLine(insight)

  return (
    <section
      aria-label="Primary behavioral leak"
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4 shadow-[0_0_32px_rgba(0,0,0,0.14)] sm:p-5",
        styles.border,
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", styles.glow)} />

      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                styles.border,
                "bg-white/[0.03]",
              )}
            >
              <Target className={cn("size-4", styles.accent)} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
                Primary behavioral leak
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-snug tracking-tight text-foreground sm:text-[16px]">
                {insight.status === "insufficient_data"
                  ? "Pattern forming"
                  : "Your costliest habit"}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide",
              styles.pill,
            )}
          >
            {confidenceLabel(insight)}
          </span>
        </div>

        <p className="text-[13px] leading-relaxed text-foreground/92 sm:text-[14px]">{insight.headline}</p>

        {evidenceLine ? (
          <p className="text-[11px] tabular-nums tracking-wide text-muted-foreground/75">{evidenceLine}</p>
        ) : insight.status === "insufficient_data" ? (
          <p className="text-[11px] text-muted-foreground/70">
            {insight.tradesRemaining > 0
              ? `${trades.length}/${insight.minTradesRequired} trades logged in lookback window`
              : `${trades.length} trades in lookback — add emotion, session, and confirmation for sharper detection`}
          </p>
        ) : null}

        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/75">
            Corrective focus
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground/88 sm:text-[13px]">
            {insight.correctiveAction}
          </p>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground/55">
          Based on your journal only — behavioral patterns, not trade signals. Last {lookbackDays} days.
        </p>
      </div>
    </section>
  )
}

/** Adapter for settings-aware dashboard usage */
export function PrimaryLeakCardWithSettings({
  trades,
  settings,
  className,
}: {
  trades: PrimaryLeakCardTrade[]
  settings?: UserSettingsForm | null
  className?: string
}) {
  return (
    <PrimaryLeakCard
      trades={trades}
      maxRiskPerTrade={settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade}
      className={className}
    />
  )
}
