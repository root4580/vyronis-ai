"use client"

import { formatAccountMoney } from "@/lib/accounts/profit-target"
import type { CouncilVisualContext } from "@/lib/council/types"
import { formatPnL } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

/** Compact stats card shown inside the chat thread after status-style replies. */
export function CouncilInlineStatsCard({
  visual,
  className,
}: {
  visual: CouncilVisualContext | null
  className?: string
}) {
  if (!visual?.stats) return null

  const { stats } = visual
  const money = (value: number) => formatAccountMoney(value, stats.currency)

  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] border border-cyan-glow/20 bg-cyan-glow/[0.05] px-3 py-2.5",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/85">
        Live snapshot
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
        <p>
          <span className="text-text-muted">Balance </span>
          <span className="font-medium tabular-nums text-text-primary">{money(stats.balance)}</span>
        </p>
        <p>
          <span className="text-text-muted">Target </span>
          <span className="font-medium tabular-nums text-text-primary">
            {money(stats.targetBalance)}
          </span>
        </p>
        <p>
          <span className="text-text-muted">Drawdown </span>
          <span className="font-medium tabular-nums text-loss">{stats.drawdownPct.toFixed(1)}%</span>
        </p>
        <p>
          <span className="text-text-muted">Trades </span>
          <span className="font-medium tabular-nums text-text-primary">
            {stats.tradesThisWeek}/{stats.maxTradesPerWeek}
          </span>
        </p>
        <p>
          <span className="text-text-muted">Discipline </span>
          <span className="font-medium tabular-nums text-text-primary">
            {stats.disciplineScore != null
              ? stats.disciplineGrade
                ? `${stats.disciplineGrade} (${Math.round(stats.disciplineScore)})`
                : `${Math.round(stats.disciplineScore)}/100`
              : "—"}
          </span>
        </p>
        <p className="col-span-2 sm:col-span-2">
          <span className="text-text-muted">Journal P&L </span>
          <span
            className={cn(
              "font-medium tabular-nums",
              stats.totalPnL > 0 ? "text-profit" : stats.totalPnL < 0 ? "text-loss" : "text-text-primary",
            )}
          >
            {formatPnL(Math.abs(stats.totalPnL), stats.totalPnL >= 0 ? "WIN" : "LOSS")}
          </span>
        </p>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-text-muted">{stats.todayJournalLine}</p>
    </article>
  )
}
