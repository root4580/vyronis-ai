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

const TONE_STYLES: Record<
  RiskAwarenessTone,
  { border: string; bg: string; icon: string; dot: string }
> = {
  info: {
    border: "border-cyan-glow/18",
    bg: "bg-cyan-glow/[0.04]",
    icon: "text-cyan-glow/90",
    dot: "bg-cyan-glow/80",
  },
  caution: {
    border: "border-amber-500/22",
    bg: "bg-amber-500/[0.05]",
    icon: "text-amber-200/90",
    dot: "bg-amber-400/90",
  },
  elevated: {
    border: "border-orange-500/28",
    bg: "bg-orange-500/[0.06]",
    icon: "text-orange-200/95",
    dot: "bg-orange-400/95",
  },
}

function BannerRow({ banner }: { banner: RiskAwarenessBanner }) {
  const tone = TONE_STYLES[banner.tone]

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 sm:px-3.5",
        tone.border,
        tone.bg,
      )}
    >
      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-foreground/95 sm:text-[12px]">
          {banner.title}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/80">{banner.message}</p>
      </div>
      <ChevronRight className={cn("mt-0.5 size-3.5 shrink-0 opacity-40", tone.icon)} aria-hidden />
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

  const headerTone =
    awareness.overallTone === "elevated"
      ? TONE_STYLES.elevated
      : awareness.overallTone === "caution"
        ? TONE_STYLES.caution
        : TONE_STYLES.info

  return (
    <section
      aria-label="Live risk awareness"
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 shadow-[0_0_24px_rgba(0,0,0,0.12)] sm:p-3.5",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg border",
              headerTone.border,
              headerTone.bg,
            )}
          >
            <Brain className={cn("size-3.5", headerTone.icon)} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              Coach awareness
            </p>
            <p className="truncate text-[12px] font-medium text-foreground/90">
              Session signals worth a pause
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 text-[10px] text-muted-foreground/60 sm:flex">
          <Activity className="size-3" />
          <span>Live</span>
        </div>
      </div>

      <div className="space-y-2">
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
