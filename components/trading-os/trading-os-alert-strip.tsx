"use client"

import { AlertTriangle, Shield, Radio } from "lucide-react"
import type { TradingOsSnapshot } from "@/lib/trading-os/types"
import { cn } from "@/lib/utils"

type TradingOsAlertStripProps = {
  tradingOs: TradingOsSnapshot | null | undefined
  className?: string
}

const SEVERITY_STYLES = {
  info: "border-accent/20 bg-accent/[0.05] text-cyan-100/90",
  warning: "border-warning/30 bg-warning/[0.08] text-amber-100/95",
  critical: "border-rose-500/35 bg-rose-500/[0.1] text-rose-100/95",
} as const

export function TradingOsAlertStrip({ tradingOs, className }: TradingOsAlertStripProps) {
  if (!tradingOs) return null

  const { intervention, liveSession, liveCompanion } = tradingOs
  const severity = intervention.active ? intervention.severity : liveSession.alerts[0]?.severity ?? "info"
  const style = SEVERITY_STYLES[severity]

  return (
    <div className={cn("shrink-0 rounded-xl border px-3 py-2.5 backdrop-blur-sm", style, className)}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
          {intervention.active ? (
            <Shield className="size-3.5 opacity-90" />
          ) : (
            <Radio className="size-3.5 opacity-80" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-medium leading-snug">
            {intervention.active ? intervention.headline : tradingOs.proactiveHeadline}
          </p>
          {intervention.active ? (
            <p className="text-[10px] leading-relaxed opacity-90">{intervention.message}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] opacity-75">
            <span>{liveSession.activeSession}</span>
            <span>Overtrade {liveSession.overtradingLevel}</span>
            <span>Drift {liveSession.emotionalDriftScore}</span>
            {liveCompanion.active ? (
              <span>Live: {liveCompanion.executionQuality}/100</span>
            ) : null}
          </div>
          {intervention.active && !intervention.canProceedToEntry ? (
            <p className="flex items-center gap-1 text-[10px] text-rose-200/95">
              <AlertTriangle className="size-3 shrink-0" />
              Entry blocked until reflection reset
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
