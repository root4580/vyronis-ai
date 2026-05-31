"use client"

import { Pencil, Trash2 } from "lucide-react"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { formatRiskReward, getTradeRiskReward } from "@/lib/trade-form-utils"
import { computePlanDisciplineForTrade } from "@/lib/trade-planner/plan-discipline-aggregate"
import { formatPlanDeviationSummary } from "@/lib/trade-planner/deviation-summary"
import { disciplineGradeBoxClass } from "@/lib/trade-planner/plan-streak"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

function formatTradeDate(trade: DashboardTradeRow): string {
  const raw = trade.trade_date ?? trade.created_at
  if (!raw) return "—"
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.split("T")[0] ?? "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function sessionLabel(session: string | null | undefined): string {
  if (!session) return "—"
  return session.replace(" Session", "")
}

export function JournalTradeCards({
  trades,
  plansById,
  onViewTrade,
  onEdit,
  onDelete,
}: {
  trades: DashboardTradeRow[]
  plansById?: Map<string, MatchableTradePlan>
  variant?: "default" | "compact"
  onViewTrade?: (trade: DashboardTradeRow) => void
  onEdit?: (trade: DashboardTradeRow) => void
  onDelete?: (trade: DashboardTradeRow) => void
  onScreenshotClick?: (trade: DashboardTradeRow) => void
}) {
  if (trades.length === 0) return null

  return (
    <div className="space-y-2">
      {trades.map((trade) => {
        const plan = trade.plan_id && plansById ? plansById.get(trade.plan_id) : undefined
        const discipline =
          plan && trade.plan_id
            ? computePlanDisciplineForTrade(
                {
                  id: trade.id,
                  plan_id: trade.plan_id,
                  pair: trade.pair,
                  direction: trade.direction,
                  result: trade.result,
                  pnl: trade.pnl,
                  trade_date: trade.trade_date ?? null,
                  created_at: trade.created_at,
                  entry_price: trade.entry_price,
                  stop_loss: trade.stop_loss,
                  take_profit: trade.take_profit,
                  risk_percent: trade.risk_percent,
                  risk_reward: trade.risk_reward,
                },
                plan,
              )
            : null
        const deviationSummary = discipline ? formatPlanDeviationSummary(discipline) : null
        const tradeRr = getTradeRiskReward(trade)

        return (
          <article
            key={trade.id}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-[14px] py-[11px] transition-colors hover:border-[var(--border-default)]"
          >
            <button
              type="button"
              onClick={() => onViewTrade?.(trade)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-text-primary">{trade.pair}</span>
                <span
                  className={cn(
                    "rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium",
                    trade.direction === "BUY"
                      ? "bg-[rgb(from_var(--color-profit)_r_g_b_/_0.1)] text-[var(--color-profit)]"
                      : "bg-[rgb(from_var(--color-loss)_r_g_b_/_0.1)] text-[var(--color-loss)]",
                  )}
                >
                  {trade.direction}
                </span>
                <span className="min-w-0 truncate text-[11px] text-text-muted">
                  {sessionLabel(trade.session)}
                </span>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-[13px] font-medium tabular-nums",
                    getPnLTextClass(trade.pnl, trade.result ?? ""),
                  )}
                >
                  {formatPnL(trade.pnl, trade.result ?? "")}
                </span>
              </div>
            </button>

            <div className="mt-0.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onViewTrade?.(trade)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="text-[10px] text-text-muted">{formatTradeDate(trade)}</span>
                <span className="text-[10px] text-text-muted">R:R {formatRiskReward(tradeRr)}</span>
                {discipline ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                      disciplineGradeBoxClass(discipline.grade),
                    )}
                  >
                    {discipline.grade} · {discipline.score}
                  </span>
                ) : null}
              </button>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                {onEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(trade)}
                    className="flex size-6 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                    aria-label="Edit trade"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(trade)}
                    className="flex size-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-loss)]/80 transition-colors hover:bg-[rgb(from_var(--color-loss)_r_g_b_/_0.08)] hover:text-[var(--color-loss)]"
                    aria-label="Delete trade"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            {trade.plan_id && deviationSummary ? (
              <p className="mt-1 text-[10px] text-text-muted">{deviationSummary}</p>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
