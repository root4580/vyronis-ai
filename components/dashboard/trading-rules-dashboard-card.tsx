"use client"

import { CalendarClock, ShieldCheck, Sparkles } from "lucide-react"
import type { TradingRulesSnapshot } from "@/lib/trading-rules/types"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { cn } from "@/lib/utils"

type TradingRulesDashboardCardProps = {
  snapshot: TradingRulesSnapshot | null
  className?: string
}

function formatCoachDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function TradingRulesDashboardCard({
  snapshot,
  className,
}: TradingRulesDashboardCardProps) {
  if (!snapshot) return null

  return (
    <DashboardInsetPanel className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-cyan-glow" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
          Rule enforcement
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-sm)] border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-text-muted">
            <CalendarClock className="size-3.5" />
            Trades this week
          </div>
          <p className="text-[18px] font-semibold tabular-nums text-text-primary">
            {snapshot.tradesThisWeek}/{snapshot.rules.max_trades_per_week}
          </p>
          <p className="mt-1 text-[10px] text-text-muted">{snapshot.weeklyUsageLabel}</p>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-text-muted">
            <Sparkles className="size-3.5" />
            Cooldown status
          </div>
          <p
            className={cn(
              "text-[18px] font-semibold",
              snapshot.cooldownRequired ? "text-loss" : "text-profit",
            )}
          >
            {snapshot.cooldownStatusLabel}
          </p>
          <p className="mt-1 text-[10px] text-text-muted">
            Loss streak: {snapshot.lossStreak}/{snapshot.rules.loss_streak_limit}
          </p>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.08em] text-text-muted">
            Last coach unlock
          </p>
          <p className="text-[18px] font-semibold tabular-nums text-text-primary">
            {formatCoachDate(snapshot.cooldown.last_coach_unlock_at)}
          </p>
          <p className="mt-1 text-[10px] text-text-muted">
            Min emotional score: {snapshot.rules.min_emotional_score}/10
          </p>
        </div>
      </div>
    </DashboardInsetPanel>
  )
}
