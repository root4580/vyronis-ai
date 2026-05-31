"use client"

import type { TradePlanCalculation } from "@/lib/trade-planner/types"
import { formatPlanPrice, formatRiskReward } from "@/lib/trade-planner/trade-plan-engine"
import { cn } from "@/lib/utils"

type TradePlanVisualProps = {
  plan: TradePlanCalculation | null
  className?: string
}

function rrBadgeClass(rr: number | null): string {
  if (rr == null) return "border-[var(--border-subtle)] bg-white/[0.05] text-text-muted"
  if (rr >= 2) return "border-profit/20 bg-profit/10 text-profit"
  if (rr >= 1) return "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning-foreground"
  return "border-loss/20 bg-loss/10 text-loss"
}

export function TradePlanVisual({ plan, className }: TradePlanVisualProps) {
  if (!plan || plan.entryPrice <= 0) {
    return (
      <div
        className={cn(
          "flex min-h-[280px] items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-input)]",
          className,
        )}
      >
        <p className="text-[12px] text-text-muted">Enter entry, stop, and target to preview the plan box.</p>
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
    <div className={cn("relative min-h-[280px] overflow-hidden", className)}>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[var(--border-subtle)] px-1 pb-2">
        <span className="text-[10px] font-medium text-text-muted">Plan box</span>
        <span
          className={cn(
            "rounded-[var(--radius-sm)] border px-2 py-0.5 text-[12px] font-medium tabular-nums",
            rrBadgeClass(plan.rr),
          )}
        >
          {formatRiskReward(plan.rr)}
        </span>
      </div>

      <div className="relative h-[240px] px-2 pt-10">
        <div
          className={cn(
            "absolute left-12 right-12 rounded-[var(--radius-sm)] border-t",
            isBuy ? "border-profit/30 bg-profit/[0.08]" : "border-loss/25 bg-loss/[0.08]",
          )}
          style={{
            top: `${Math.min(zoneTop, entryTop)}%`,
            height: `${Math.abs(zoneTop - entryTop)}%`,
          }}
        />
        <div
          className={cn(
            "absolute left-12 right-12 rounded-[var(--radius-sm)] border-b",
            isBuy ? "border-loss/25 bg-loss/[0.08]" : "border-profit/30 bg-profit/[0.08]",
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
    tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-text-primary"

  return (
    <div className="absolute left-0 right-0" style={{ top: `${top}%` }}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-px flex-1 border-t border-dashed",
            tone === "profit"
              ? "border-profit/40"
              : tone === "loss"
                ? "border-loss/40"
                : "border-white/40",
          )}
        />
        <div className="min-w-[128px] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-page)] px-2 py-1">
          <p className={cn("text-[11px] font-medium", toneClass)}>{label}</p>
          <p className={cn("text-[11px] font-medium tabular-nums", toneClass)}>{price}</p>
          <p className="text-[10px] text-text-muted">{meta}</p>
        </div>
      </div>
    </div>
  )
}
