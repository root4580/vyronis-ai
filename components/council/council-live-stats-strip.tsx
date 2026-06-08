"use client"

import { formatAccountMoney } from "@/lib/accounts/profit-target"
import type { CouncilVisualContext } from "@/lib/council/types"
import { formatPnL } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

function Metric({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string
  value: string
  detail?: string
  valueClassName?: string
}) {
  return (
    <div className="min-w-0 rounded-[var(--radius-sm)] border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <p className={cn("mt-0.5 truncate text-[13px] font-medium tabular-nums text-text-primary", valueClassName)}>
        {value}
      </p>
      {detail ? <p className="mt-0.5 truncate text-[10px] text-text-muted">{detail}</p> : null}
    </div>
  )
}

export function CouncilLiveStatsStrip({
  visual,
  className,
  loading,
}: {
  visual: CouncilVisualContext | null
  className?: string
  loading?: boolean
}) {
  if (loading && !visual) {
    return (
      <section
        className={cn(
          "rounded-[var(--radius-md)] border border-white/[0.06] bg-black/20 px-3 py-2.5",
          className,
        )}
      >
        <p className="text-[11px] text-text-muted animate-pulse">Loading live stats…</p>
      </section>
    )
  }

  if (!visual?.stats) return null

  const { stats } = visual
  const money = (value: number) => formatAccountMoney(value, stats.currency)
  const pnlClass =
    stats.totalPnL > 0 ? "text-profit" : stats.totalPnL < 0 ? "text-loss" : undefined

  return (
    <section
      className={cn(
        "rounded-[var(--radius-md)] border border-cyan-glow/15 bg-black/25 px-3 py-2.5",
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/85">
          Live stats
        </p>
        <p className="truncate text-[10px] text-text-muted">
          {stats.accountName} · {stats.chapterLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <Metric label="Balance" value={money(stats.balance)} detail="Starting + journal P&L" />
        <Metric
          label="Target"
          value={money(stats.targetBalance)}
          detail={`${Math.round(stats.targetProgressPercent)}% toward goal`}
        />
        <Metric
          label="Journal P&L"
          value={formatPnL(Math.abs(stats.totalPnL), stats.totalPnL >= 0 ? "WIN" : "LOSS")}
          detail="Logged trades"
          valueClassName={pnlClass}
        />
        <Metric
          label="Drawdown"
          value={`${stats.drawdownPct.toFixed(1)}%`}
          detail={`From ${money(stats.startingBalance)}`}
          valueClassName={stats.drawdownPct > 0 ? "text-loss" : undefined}
        />
        <Metric
          label="Trades this week"
          value={`${stats.tradesThisWeek}/${stats.maxTradesPerWeek}`}
          detail={`${stats.tradesRemaining} left`}
        />
        <Metric
          label="Discipline"
          value={
            stats.disciplineScore != null
              ? stats.disciplineGrade
                ? `${stats.disciplineGrade} (${Math.round(stats.disciplineScore)})`
                : `${Math.round(stats.disciplineScore)}/100`
              : "—"
          }
          detail={stats.disciplineScoreNote ?? "Chapter score"}
        />
        <Metric
          label="Loss today"
          value={`${stats.dailyLossPct.toFixed(1)}%`}
          detail="Daily limit used"
          valueClassName={stats.dailyLossPct > 0 ? "text-loss" : undefined}
        />
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-text-muted">{stats.todayJournalLine}</p>
      {stats.dataNote ? (
        <p className="mt-1.5 rounded-[var(--radius-sm)] border border-warning/20 bg-warning/[0.08] px-2 py-1.5 text-[10px] leading-relaxed text-warning-muted">
          {stats.dataNote}
        </p>
      ) : null}
    </section>
  )
}
