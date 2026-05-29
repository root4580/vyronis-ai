"use client"

import { updatePairAoiStatus } from "@/lib/strategy-brain/api-client"
import type { AoiStatus, PairPlanRecord } from "@/lib/strategy-brain/types"
import { AoiStatusPill, StrategyBrainGlass } from "@/components/strategy-brain/strategy-brain-primitives"
import { cn } from "@/lib/utils"

const STATUSES: AoiStatus[] = ["WAITING", "INSIDE_AOI", "CONFIRMING", "INVALIDATED"]

type Props = {
  plan: PairPlanRecord
  onStatusChange?: (plan: PairPlanRecord) => void
}

export function AoiPairCard({ plan, onStatusChange }: Props) {
  async function setStatus(status: AoiStatus) {
    await updatePairAoiStatus(plan.id, status)
    onStatusChange?.({ ...plan, aoi_status: status })
  }

  const zone =
    plan.aoi_high != null && plan.aoi_low != null
      ? `${plan.aoi_low} – ${plan.aoi_high}`
      : "Zone not set"

  return (
    <StrategyBrainGlass className="relative overflow-hidden transition-transform duration-300 hover:scale-[1.01]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-glow/40 to-transparent" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tracking-wide text-foreground">{plan.pair}</p>
          <p className="text-[10px] text-muted-foreground/70">{plan.directional_bias} thesis</p>
        </div>
        <AoiStatusPill status={plan.aoi_status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1.5">
          <p className="text-muted-foreground/55">AOI zone</p>
          <p className="font-mono text-foreground/90">{zone}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1.5">
          <p className="text-muted-foreground/55">Invalidation</p>
          <p className="font-mono text-foreground/90">
            {plan.invalidation != null ? plan.invalidation : "—"}
          </p>
        </div>
      </div>

      {plan.weekly_thesis ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-foreground/78">
          {plan.weekly_thesis}
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void setStatus(s)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] uppercase transition-colors",
              plan.aoi_status === s
                ? "bg-cyan-glow/20 text-cyan-glow"
                : "bg-white/5 text-muted-foreground hover:bg-white/10",
            )}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
    </StrategyBrainGlass>
  )
}
