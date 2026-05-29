"use client"

import { Shield } from "lucide-react"
import { cn } from "@/lib/utils"

type DashboardTrustStripProps = {
  tradeCount: number
  lastSyncedLabel?: string | null
  className?: string
}

export function DashboardTrustStrip({
  tradeCount,
  lastSyncedLabel,
  className,
}: DashboardTrustStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/75">
        <Shield className="size-3.5 text-cyan-glow/70" />
        <span>Vyronis advises — you execute</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] tabular-nums text-muted-foreground/60">
        <span>{tradeCount} trades in journal</span>
        {lastSyncedLabel ? <span>· {lastSyncedLabel}</span> : null}
      </div>
    </div>
  )
}
