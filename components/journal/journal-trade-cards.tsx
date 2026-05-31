"use client"

import { Link2, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { formatRiskReward, getTradeRiskReward } from "@/lib/trade-form-utils"
import { computePlanDisciplineForTrade } from "@/lib/trade-planner/plan-discipline-aggregate"
import { formatPlanDeviationSummary } from "@/lib/trade-planner/deviation-summary"
import { disciplineGradeBoxClass } from "@/lib/trade-planner/plan-streak"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

function formatTradeTime(trade: DashboardTradeRow): string {
  const raw = trade.trade_date ?? trade.created_at
  if (!raw) return "—"
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.split("T")[0] ?? "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function JournalTradeCards({
  trades,
  plansById,
  variant = "default",
  onViewTrade,
  onEdit,
  onDelete,
  onScreenshotClick,
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

  const compact = variant === "compact"

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3")}>
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

        if (compact) {
          return (
            <article
              key={trade.id}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3 transition-colors hover:border-[var(--border-default)]"
            >
              <button
                type="button"
                onClick={() => onViewTrade?.(trade)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-medium text-text-primary">{trade.pair}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 border-[var(--border-subtle)] text-[10px]",
                          trade.direction === "BUY"
                            ? "text-profit"
                            : trade.direction === "SELL"
                              ? "text-loss"
                              : undefined,
                        )}
                      >
                        {trade.direction}
                      </Badge>
                      {trade.session ? (
                        <Badge variant="outline" className="h-5 border-[var(--border-subtle)] text-[10px] text-text-muted">
                          {trade.session.replace(" Session", "")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">{formatTradeTime(trade)}</p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-[13px] font-medium tabular-nums",
                      getPnLTextClass(trade.pnl, trade.result ?? ""),
                    )}
                  >
                    {formatPnL(trade.pnl, trade.result ?? "")}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  <span>R:R {formatRiskReward(tradeRr)}</span>
                  {discipline ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                        disciplineGradeBoxClass(discipline.grade),
                      )}
                    >
                      {discipline.grade} · {discipline.score}
                    </span>
                  ) : null}
                  {trade.plan_id ? (
                    <span className="inline-flex items-center gap-1 text-text-accent">
                      <Link2 className="size-3" />
                      Plan linked
                    </span>
                  ) : null}
                </div>

                {trade.plan_id && deviationSummary ? (
                  <p className="mt-1.5 text-[11px] text-text-muted">{deviationSummary}</p>
                ) : null}
              </button>

              {(onEdit || onDelete || (trade.screenshot_url && onScreenshotClick)) && (
                <div className="mt-2 flex justify-end gap-1 border-t border-[var(--border-subtle)] pt-2">
                  {trade.screenshot_url && onScreenshotClick ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-text-muted"
                      onClick={() => onScreenshotClick(trade)}
                    >
                      Chart
                    </Button>
                  ) : null}
                  {onEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-text-muted"
                      onClick={() => onEdit(trade)}
                      aria-label="Edit trade"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-loss/80"
                      onClick={() => onDelete(trade)}
                      aria-label="Delete trade"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              )}
            </article>
          )
        }

        const resultTone =
          trade.result === "WIN"
            ? "border-profit/25 bg-profit/[0.06]"
            : trade.result === "LOSS"
              ? "border-loss/25 bg-loss/[0.06]"
              : "border-white/[0.08] bg-white/[0.02]"

        return (
          <article
            key={trade.id}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-4 transition-all",
              "hover:border-cyan-glow/25 hover:shadow-[0_0_24px_rgb(from var(--color-accent) r g b / 0.08)]",
              resultTone,
            )}
          >
            <div className="relative flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onViewTrade?.(trade)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight">{trade.pair}</h3>
                  <Badge variant="outline" className="h-5 border-white/10 text-[10px]">
                    {trade.direction}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {trade.session || "—"} · {trade.strategy_name || "No strategy"}
                </p>
              </button>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  getPnLTextClass(trade.pnl, trade.result ?? ""),
                )}
              >
                {formatPnL(trade.pnl, trade.result ?? "")}
              </p>
            </div>

            {trade.trade_notes ? (
              <p className="relative mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/75">
                {trade.trade_notes}
              </p>
            ) : null}

            {trade.screenshot_url ? (
              <button
                type="button"
                onClick={() => onScreenshotClick?.(trade)}
                className="relative mt-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-black/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={trade.screenshot_url} alt="" className="size-full object-cover opacity-90" />
              </button>
            ) : null}

            <div className="relative mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 bg-cyan-glow/90 text-[11px] text-black hover:bg-cyan-glow"
                onClick={() => onViewTrade?.(trade)}
              >
                View trade
              </Button>
              {onEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 border-white/[0.08]"
                  onClick={() => onEdit(trade)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 border-white/[0.08] text-loss/80"
                  onClick={() => onDelete(trade)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
