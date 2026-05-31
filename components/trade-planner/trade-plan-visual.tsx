"use client"

import type { TradePlanCalculation } from "@/lib/trade-planner/types"
import { formatPlanPrice, formatRiskReward } from "@/lib/trade-planner/trade-plan-engine"
import { cn } from "@/lib/utils"

type TradePlanVisualProps = {
  plan: TradePlanCalculation | null
  className?: string
}

export function TradePlanVisual({ plan, className }: TradePlanVisualProps) {
  if (!plan || plan.entryPrice <= 0) {
    return (
      <div
        className={cn(
          "flex min-h-[280px] items-center justify-center rounded-xl border border-white/[0.08] bg-black/30",
          className,
        )}
      >
        <p className="text-[12px] text-muted-foreground/70">Enter entry, stop, and target to preview the plan box.</p>
      </div>
    )
  }

  const isBuy = plan.direction === "BUY"
  const prices = isBuy
    ? [plan.takeProfit, plan.entryPrice, plan.stopLoss]
    : [plan.stopLoss, plan.entryPrice, plan.takeProfit]

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = Math.max(max - min, 0.00001)

  const toPercent = (price: number) => 8 + ((max - price) / span) * 84

  const entryTop = toPercent(plan.entryPrice)
  const tpTop = toPercent(plan.takeProfit)
  const slTop = toPercent(plan.stopLoss)
  const zoneTop = Math.min(tpTop, slTop)
  const zoneBottom = Math.max(tpTop, slTop)

  return (
    <div
      className={cn(
        "relative min-h-[280px] overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-black/40 to-black/20",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          Plan box
        </span>
        <span className="rounded-md border border-cyan-glow/20 bg-cyan-glow/[0.08] px-2 py-0.5 text-[10px] font-semibold text-cyan-glow">
          {formatRiskReward(plan.rr)}
        </span>
      </div>

      <div className="relative h-[240px] px-4 pt-10">
        <div
          className={cn(
            "absolute left-16 right-16 rounded-md border",
            isBuy ? "border-profit/20 bg-profit/[0.12]" : "border-loss/20 bg-loss/[0.12]",
          )}
          style={{
            top: `${Math.min(zoneTop, entryTop)}%`,
            height: `${Math.abs(zoneTop - entryTop)}%`,
          }}
        />
        <div
          className={cn(
            "absolute left-16 right-16 rounded-md border",
            isBuy ? "border-loss/20 bg-loss/[0.12]" : "border-profit/20 bg-profit/[0.12]",
          )}
          style={{
            top: `${Math.min(zoneBottom, entryTop)}%`,
            height: `${Math.abs(zoneBottom - entryTop)}%`,
          }}
        />

        <PlanLevelLine
          top={tpTop}
          label="Take profit"
          price={formatPlanPrice(plan.takeProfit, plan.pair)}
          meta={`${plan.tpPips.toFixed(1)} pips`}
          tone="profit"
        />
        <PlanLevelLine
          top={entryTop}
          label="Entry"
          price={formatPlanPrice(plan.entryPrice, plan.pair)}
          meta={plan.direction}
          tone="neutral"
        />
        <PlanLevelLine
          top={slTop}
          label="Stop loss"
          price={formatPlanPrice(plan.stopLoss, plan.pair)}
          meta={`${plan.slPips.toFixed(1)} pips`}
          tone="loss"
        />
      </div>
    </div>
  )
}

function PlanLevelLine({
  top,
  label,
  price,
  meta,
  tone,
}: {
  top: number
  label: string
  price: string
  meta: string
  tone: "profit" | "loss" | "neutral"
}) {
  const toneClass =
    tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-cyan-glow"

  return (
    <div className="absolute left-0 right-0" style={{ top: `${top}%` }}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-px flex-1",
            tone === "profit" ? "bg-profit/50" : tone === "loss" ? "bg-loss/50" : "bg-cyan-glow/50",
          )}
        />
        <div className="min-w-[132px] rounded-md border border-white/[0.08] bg-black/50 px-2 py-1">
          <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
          <p className={cn("text-[11px] font-semibold tabular-nums", toneClass)}>{price}</p>
          <p className="text-[9px] text-muted-foreground/65">{meta}</p>
        </div>
      </div>
    </div>
  )
}
