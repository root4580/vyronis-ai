"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Crosshair, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatAccountMoney } from "@/lib/accounts/profit-target"
import type { CouncilChartSnapshot, CouncilVisualContext } from "@/lib/council/types"
import { getWarRoomCoachHref, getWarRoomHref } from "@/lib/dashboard-nav"
import { formatPnL } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type CouncilContextPanelProps = {
  visual: CouncilVisualContext | null
  onChartClick?: (url: string, title: string) => void
  className?: string
}

function StatTile({
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
    <div className="rounded-[var(--radius-sm)] border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[14px] font-medium tabular-nums text-text-primary",
          valueClassName,
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[10px] text-text-muted">{detail}</p> : null}
    </div>
  )
}

function ChartSnapshot({
  chart,
  className,
  onClick,
}: {
  chart: CouncilChartSnapshot
  className?: string
  onClick?: () => void
}) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={chart.url}
        alt={chart.label}
        className="h-28 w-full object-cover sm:h-32"
      />
      <figcaption className="border-t border-white/[0.06] px-2 py-1.5 text-[10px] text-text-secondary">
        {chart.label}
        {onClick ? " · tap to expand" : ""}
      </figcaption>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "block w-full overflow-hidden rounded-[var(--radius-md)] border border-white/[0.08] bg-black/30 text-left transition-colors hover:border-cyan-glow/25",
          className,
        )}
      >
        {body}
      </button>
    )
  }

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-[var(--radius-md)] border border-white/[0.08] bg-black/30",
        className,
      )}
    >
      {body}
    </figure>
  )
}

export function CouncilContextPanel({ visual, onChartClick, className }: CouncilContextPanelProps) {
  const charts = useMemo(() => {
    if (!visual) return []
    const seen = new Set<string>()
    const items: CouncilChartSnapshot[] = []
    for (const chart of [...visual.watchlistCharts, visual.lastTradeChart].filter(Boolean)) {
      if (!chart || seen.has(chart.url)) continue
      seen.add(chart.url)
      items.push(chart)
    }
    return items
  }, [visual])

  if (!visual) return null

  const { stats } = visual
  const money = (value: number) => formatAccountMoney(value, stats.currency)
  const pnlClass =
    stats.totalPnL > 0 ? "text-profit" : stats.totalPnL < 0 ? "text-loss" : undefined
  const primaryPair = visual.watchlistCharts[0]?.pair ?? null
  const coachHref = primaryPair
    ? getWarRoomCoachHref([primaryPair])
    : getWarRoomCoachHref([])

  return (
    <section className={cn("space-y-3", className)}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="chart-grid overflow-hidden rounded-[var(--radius-md)] border border-white/[0.06] bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/85">
              Live stats
            </p>
            <span className="truncate text-[10px] text-text-muted">
              {stats.accountName} · {stats.chapterLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Starting"
              value={money(stats.startingBalance)}
              detail="Account baseline in Vyronis"
            />
            <StatTile
              label="Journal P&L"
              value={formatPnL(Math.abs(stats.totalPnL), stats.totalPnL >= 0 ? "WIN" : "LOSS")}
              detail="From logged trades"
              valueClassName={pnlClass}
            />
            <StatTile
              label="Balance"
              value={money(stats.balance)}
              detail="Starting + journal P&L"
            />
            <StatTile
              label="Drawdown"
              value={`${stats.drawdownPct.toFixed(1)}%`}
              detail="From starting balance"
              valueClassName={stats.drawdownPct > 0 ? "text-loss" : undefined}
            />
            <StatTile
              label="Loss today"
              value={`${stats.dailyLossPct.toFixed(1)}%`}
              detail="Of daily limit used"
              valueClassName={stats.dailyLossPct > 0 ? "text-loss" : undefined}
            />
            <StatTile
              label="Trades this week"
              value={`${stats.tradesThisWeek}/${stats.maxTradesPerWeek}`}
              detail={`${stats.tradesRemaining} slot${stats.tradesRemaining === 1 ? "" : "s"} left`}
            />
            <StatTile
              label="Discipline"
              value={stats.disciplineScore != null ? `${Math.round(stats.disciplineScore)}/100` : "—"}
              detail={stats.disciplineScore != null ? "Chapter score" : "Not enough data"}
              valueClassName={stats.disciplineScore != null ? undefined : undefined}
            />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-text-muted">{stats.todayJournalLine}</p>
          {stats.dataNote ? (
            <p className="mt-1.5 rounded-[var(--radius-sm)] border border-warning/20 bg-warning/[0.08] px-2 py-1.5 text-[10px] leading-relaxed text-warning-muted">
              {stats.dataNote}
            </p>
          ) : null}
        </div>

        {charts.length > 0 ? (
          <div className="chart-grid overflow-hidden rounded-[var(--radius-md)] border border-white/[0.06] bg-black/20 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200/85">
              Charts from your history
            </p>
            <div
              className={cn(
                "grid gap-2",
                charts.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
              )}
            >
              {charts.map((chart) => (
                <ChartSnapshot
                  key={chart.url}
                  chart={chart}
                  onClick={
                    onChartClick
                      ? () => onChartClick(chart.url, chart.label)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="chart-grid flex min-h-[140px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-white/[0.08] bg-black/15 px-4 py-6 text-center">
            <p className="max-w-xs text-[11px] leading-relaxed text-text-muted">
              Upload War Room charts or attach a screenshot on your last trade — they will show here
              while the council speaks.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-9 text-[11px]">
          <Link href={getWarRoomHref()}>
            <Crosshair className="mr-1.5 size-3.5" />
            Open War Room
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="min-h-9 text-[11px]">
          <Link href={coachHref}>
            <Sparkles className="mr-1.5 size-3.5" />
            {primaryPair ? `Analyze ${primaryPair}` : "Open Coach"}
          </Link>
        </Button>
      </div>
    </section>
  )
}
