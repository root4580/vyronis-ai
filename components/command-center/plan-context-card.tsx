"use client"

import { Link2 } from "lucide-react"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

function contextRow(label: string, value: string | null | undefined) {
  if (!value?.trim()) return null
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span className="truncate text-right font-medium text-text-primary">{value}</span>
    </div>
  )
}

export function PlanContextCard({ context }: { context: PreTradePlannedContext }) {
  const hasPlan =
    Boolean(context.pair) ||
    Boolean(context.trade_plan_id) ||
    Boolean(context.setup) ||
    Boolean(context.entry_price)

  if (!hasPlan) return null

  const direction =
    context.direction === "LONG" || context.direction === "BUY"
      ? "Long"
      : context.direction === "SHORT" || context.direction === "SELL"
        ? "Short"
        : context.direction

  return (
    <div
      className={cn(
        "shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-accent-border)]",
        "bg-[rgb(from_var(--color-accent)_r_g_b_/_0.06)] px-4 py-3",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Link2 className="size-3.5 text-text-accent" aria-hidden />
        <p className="section-label text-text-accent">Plan context</p>
      </div>

      <div className="space-y-1.5">
        {context.pair ? (
          <p className="text-[13px] font-medium text-text-primary">
            {context.pair}
            {direction ? ` · ${direction}` : ""}
          </p>
        ) : null}
        {contextRow("Setup", context.setup)}
        {contextRow("Session", context.session?.replace(" Session", ""))}
        {contextRow("Entry", context.entry_price)}
        {contextRow("Stop", context.stop_loss)}
        {contextRow("Target", context.take_profit)}
        {contextRow("Risk", context.risk_percent ? `${context.risk_percent}%` : null)}
        {contextRow("HTF", context.higher_timeframe)}
        {context.confirmation_signal
          ? contextRow("Confirmation", context.confirmation_signal)
          : null}
      </div>
    </div>
  )
}
