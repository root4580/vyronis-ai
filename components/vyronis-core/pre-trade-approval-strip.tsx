"use client"

import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react"
import type { VyronisCoreSnapshot } from "@/lib/vyronis-core/types"
import { cn } from "@/lib/utils"

type PreTradeApprovalStripProps = {
  vyronisCore: VyronisCoreSnapshot | null | undefined
  className?: string
}

const STATUS_CONFIG = {
  approved: {
    icon: ShieldCheck,
    style: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-100/95",
  },
  reduced: {
    icon: ShieldAlert,
    style: "border-amber-500/30 bg-amber-500/[0.08] text-amber-100/95",
  },
  reflection_required: {
    icon: ShieldAlert,
    style: "border-violet-500/30 bg-violet-500/[0.08] text-violet-100/95",
  },
  blocked: {
    icon: ShieldX,
    style: "border-rose-500/35 bg-rose-500/[0.1] text-rose-100/95",
  },
} as const

export function PreTradeApprovalStrip({ vyronisCore, className }: PreTradeApprovalStripProps) {
  if (!vyronisCore) return null

  const approval = vyronisCore.phase5.preTradeApproval
  const config = STATUS_CONFIG[approval.status]
  const Icon = config.icon

  return (
    <div className={cn("shrink-0 rounded-xl border px-3 py-2 backdrop-blur-sm", config.style, className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 opacity-90" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium">{approval.headline}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {approval.verdict}
            </span>
          </div>
          {approval.reasons[0] ? (
            <p className="text-[10px] leading-relaxed opacity-90">{approval.reasons[0]}</p>
          ) : null}
          <p className="text-[10px] opacity-70">
            Setup {vyronisCore.phase5.setupProbability.score}% · Confidence{" "}
            {vyronisCore.phase5.confidenceDecay.currentConfidence}% · Max risk{" "}
            {vyronisCore.phase5.adaptiveRisk.maxRiskPercent}%
          </p>
        </div>
      </div>
    </div>
  )
}
