"use client"

import { useMemo } from "react"
import { Activity, Brain, ChevronRight, Shield } from "lucide-react"
import {
  evaluateDashboardRiskAwareness,
  mapTradeToRiskHistory,
  type RiskAwarenessBanner,
  type RiskAwarenessTone,
} from "@/lib/dashboard-risk-awareness"
import {
  DEFAULT_USER_SETTINGS,
  normalizeUserSettings,
  type UserSettingsForm,
} from "@/lib/user-settings"
import { cn } from "@/lib/utils"

type RiskGuardBannerTrade = Parameters<typeof mapTradeToRiskHistory>[0]

type RiskGuardBannerProps = {
  trades: RiskGuardBannerTrade[]
  settings?: UserSettingsForm | null
  startingBalance?: number
  className?: string
}

const TONE_DOT: Record<RiskAwarenessTone, string> = {
  info: "bg-cyan-glow/80",
  caution: "bg-warning/90",
  elevated: "bg-orange-400/95",
}

function BannerRow({ banner }: { banner: RiskAwarenessBanner }) {
  return (
    <div className="coach-awareness-row">
      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TONE_DOT[banner.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-foreground/95 sm:text-[12px]">{banner.title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/80">{banner.message}</p>
      </div>
      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
    </div>
  )
}

export function RiskGuardBanner({
  trades,
  settings,
  startingBalance = DEFAULT_USER_SETTINGS.starting_balance,
  className,
}: RiskGuardBannerProps) {
  const awareness = useMemo(() => {
    const resolvedSettings = normalizeUserSettings(settings ?? DEFAULT_USER_SETTINGS)
    return evaluateDashboardRiskAwareness({
      settings: resolvedSettings,
      startingBalance,
      historicalTrades: trades.map(mapTradeToRiskHistory),
    })
  }, [trades, settings, startingBalance])

  if (awareness.banners.length === 0) {
    return null
  }

  const headerDot =
    awareness.overallTone === "elevated"
      ? TONE_DOT.elevated
      : awareness.overallTone === "caution"
        ? TONE_DOT.caution
        : TONE_DOT.info

  return (
    <section
      aria-label="Live risk awareness"
      className={cn(
        "vyronis-card shadow-[0_0_24px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-transparent">
            <Brain className="size-3.5 text-text-accent" />
          </div>
          <div className="min-w-0">
            <p className="section-label">Coach awareness</p>
            <p className="truncate text-[12px] font-medium text-foreground/90">
              Session signals worth a pause
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 text-[10px] text-muted-foreground/60 sm:flex">
          <span className={cn("size-1.5 rounded-full", headerDot)} aria-hidden />
          <Activity className="size-3" />
          <span>Live</span>
        </div>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {awareness.banners.map((banner) => (
          <BannerRow key={banner.id} banner={banner} />
        ))}
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground/55">
        <Shield className="mt-0.5 size-3 shrink-0 opacity-60" />
        Awareness only — you stay in control. High-risk logs still ask for intentional confirmation.
      </p>
    </section>
  )
}
