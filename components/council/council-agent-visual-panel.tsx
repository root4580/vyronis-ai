"use client"

import { formatAccountMoney } from "@/lib/accounts/profit-target"
import type { CouncilAgentVisualPanel } from "@/lib/council/agent-visual-panel"
import type { CouncilChartSnapshot, CouncilVisualContext } from "@/lib/council/types"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import { formatPnL } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type CouncilAgentVisualPanelProps = {
  panel: CouncilAgentVisualPanel
  visual: CouncilVisualContext
  speaking?: boolean
  onChartClick?: (url: string, title: string) => void
}

function ChartThumb({
  chart,
  onChartClick,
  className,
}: {
  chart: CouncilChartSnapshot
  onChartClick?: (url: string, title: string) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChartClick?.(chart.url, chart.label)}
      className={cn(
        "block w-full overflow-hidden rounded-lg border border-white/[0.08] bg-black/35 text-left transition-colors hover:border-cyan-glow/25",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={chart.url} alt={chart.label} className="max-h-40 w-full object-cover" />
      <span className="block border-t border-white/[0.06] px-2 py-1 text-[10px] text-text-secondary">
        {chart.label} · tap to expand
      </span>
    </button>
  )
}

function CouncilNewsPanel({ calendar }: { calendar: TodayCalendarResponse | null }) {
  if (!calendar?.connected) {
    return (
      <p className="text-[11px] leading-relaxed text-text-muted">
        {calendar?.setupMessage ??
          "Economic calendar not connected — open War Room and add FXStreet in .env."}
      </p>
    )
  }

  const events = calendar.events.filter((event) => event.impact === "high").slice(0, 6)
  if (events.length === 0) {
    return (
      <p className="text-[11px] leading-relaxed text-text-muted">
        No high-impact releases on your watchlist currencies for the rest of today.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li
          key={event.dateUtc}
          className="rounded-lg border border-loss/20 bg-loss/[0.05] px-2.5 py-2 text-[11px]"
        >
          <p className="font-medium text-text-primary">
            {event.time} · {event.currency} · {event.event}
          </p>
          <p className="mt-0.5 text-text-muted">
            {event.minutesUntil < 0
              ? "Passed"
              : event.minutesUntil === 0
                ? "Now"
                : `In ${event.minutesUntil} min`}
            {event.avoidPairs.length > 0
              ? ` · Avoid ${event.avoidPairs.slice(0, 3).map(formatPairForSpeech).join(", ")}`
              : ""}
          </p>
        </li>
      ))}
    </ul>
  )
}

function DisciplinePanel({
  visual,
  variant,
}: {
  visual: CouncilVisualContext
  variant?: "chapter" | "psychology"
}) {
  const { stats } = visual
  const score = stats.disciplineScore
  const pct = score != null ? Math.min(100, Math.max(0, score)) : null

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
        variant === "psychology" && "sm:grid-cols-1",
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border px-3 py-4",
          variant === "psychology"
            ? "border-purple-500/30 bg-purple-950/40"
            : "border-rose-400/25 bg-rose-500/[0.06]",
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Discipline score
        </p>
        <p className="mt-1 text-[28px] font-semibold tabular-nums leading-none text-text-primary">
          {score != null ? Math.round(score) : "—"}
        </p>
        {stats.disciplineGrade ? (
          <p className="mt-1 text-[12px] font-medium text-text-secondary">{stats.disciplineGrade}</p>
        ) : null}
        {stats.disciplineScoreNote ? (
          <p className="mt-2 max-w-[220px] text-center text-[10px] leading-relaxed text-text-muted">
            {stats.disciplineScoreNote}
          </p>
        ) : null}
        {pct != null ? (
          <div className="mt-3 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full",
                variant === "psychology" ? "bg-purple-400/80" : "bg-rose-400/80",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-1 text-[11px] leading-relaxed text-text-secondary">
        <p>
          <span className="text-text-muted">Chapter </span>
          <span className="font-medium text-text-primary">{stats.chapterLabel}</span>
        </p>
        <p>
          <span className="text-text-muted">Trades this week </span>
          <span className="font-medium tabular-nums text-text-primary">
            {stats.tradesThisWeek}/{stats.maxTradesPerWeek}
          </span>
          <span className="text-text-muted"> · {stats.tradesRemaining} left</span>
        </p>
        <p className="text-[10px] text-text-muted">{stats.todayJournalLine}</p>
      </div>
    </div>
  )
}

function RiskPanel({ visual }: { visual: CouncilVisualContext }) {
  const { stats } = visual
  const money = (value: number) => formatAccountMoney(value, stats.currency)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2.5 py-2">
        <p className="text-[9px] uppercase tracking-wide text-text-muted">Balance</p>
        <p className="text-[13px] font-semibold tabular-nums">{money(stats.balance)}</p>
      </div>
      <div className="rounded-lg border border-loss/25 bg-loss/[0.06] px-2.5 py-2">
        <p className="text-[9px] uppercase tracking-wide text-text-muted">Drawdown</p>
        <p className="text-[13px] font-semibold tabular-nums text-loss">
          {stats.drawdownPct.toFixed(1)}%
        </p>
      </div>
      <div className="rounded-lg border border-loss/20 bg-loss/[0.05] px-2.5 py-2">
        <p className="text-[9px] uppercase tracking-wide text-text-muted">Daily loss</p>
        <p className="text-[13px] font-semibold tabular-nums text-loss">
          {stats.dailyLossPct.toFixed(1)}%
        </p>
      </div>
      <div className="rounded-lg border border-white/[0.08] bg-black/25 px-2.5 py-2">
        <p className="text-[9px] uppercase tracking-wide text-text-muted">Weekly slots</p>
        <p className="text-[13px] font-semibold tabular-nums">
          {stats.tradesThisWeek}/{stats.maxTradesPerWeek}
        </p>
        <p className="text-[9px] text-text-muted">{stats.tradesRemaining} remaining</p>
      </div>
      <div className="col-span-2 rounded-lg border border-white/[0.08] bg-black/25 px-2.5 py-2 sm:col-span-2">
        <p className="text-[9px] uppercase tracking-wide text-text-muted">Target progress</p>
        <p className="text-[12px] font-medium tabular-nums">
          {money(stats.targetBalance)} · {Math.round(stats.targetProgressPercent)}%
        </p>
      </div>
    </div>
  )
}

function StatsOverviewPanel({ visual }: { visual: CouncilVisualContext }) {
  const { stats } = visual
  const money = (value: number) => formatAccountMoney(value, stats.currency)

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
      <p>
        <span className="text-text-muted">Balance </span>
        <span className="font-medium tabular-nums">{money(stats.balance)}</span>
      </p>
      <p>
        <span className="text-text-muted">Drawdown </span>
        <span className="font-medium tabular-nums text-loss">{stats.drawdownPct.toFixed(1)}%</span>
      </p>
      <p>
        <span className="text-text-muted">Trades </span>
        <span className="font-medium tabular-nums">
          {stats.tradesThisWeek}/{stats.maxTradesPerWeek}
        </span>
      </p>
      <p>
        <span className="text-text-muted">Discipline </span>
        <span className="font-medium tabular-nums">
          {stats.disciplineScore != null ? Math.round(stats.disciplineScore) : "—"}
        </span>
      </p>
      <p className="col-span-2 sm:col-span-2">
        <span className="text-text-muted">Journal P&L </span>
        <span
          className={cn(
            "font-medium tabular-nums",
            stats.totalPnL > 0 ? "text-profit" : stats.totalPnL < 0 ? "text-loss" : "",
          )}
        >
          {formatPnL(Math.abs(stats.totalPnL), stats.totalPnL >= 0 ? "WIN" : "LOSS")}
        </span>
      </p>
    </div>
  )
}

export function CouncilAgentVisualPanel({
  panel,
  visual,
  speaking = false,
  onChartClick,
}: CouncilAgentVisualPanelProps) {
  return (
    <div
      className={cn(
        "mt-2 overflow-hidden rounded-lg border bg-black/25 transition-shadow",
        speaking
          ? "border-cyan-glow/35 shadow-[0_0_16px_rgba(34,211,238,0.12)]"
          : "border-white/[0.08]",
      )}
    >
      <p className="border-b border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        {panel.title}
        {speaking ? " · live" : ""}
      </p>
      <div className="p-2.5">
        {panel.kind === "discipline" ? (
          <DisciplinePanel visual={visual} variant={panel.variant} />
        ) : null}
        {panel.kind === "risk" ? <RiskPanel visual={visual} /> : null}
        {panel.kind === "stats-overview" ? <StatsOverviewPanel visual={visual} /> : null}
        {panel.kind === "trades" ? (
          <div className={cn("grid gap-2", panel.charts.length > 1 && "sm:grid-cols-2")}>
            {panel.charts.map((chart) => (
              <ChartThumb key={chart.url} chart={chart} onChartClick={onChartClick} />
            ))}
          </div>
        ) : null}
        {panel.kind === "watchlist" ? (
          <div className={cn("grid gap-2", panel.charts.length > 1 && "sm:grid-cols-2")}>
            {panel.charts.map((chart) => (
              <ChartThumb key={chart.url} chart={chart} onChartClick={onChartClick} />
            ))}
          </div>
        ) : null}
        {panel.kind === "chart" ? (
          <ChartThumb chart={panel.chart} onChartClick={onChartClick} />
        ) : null}
        {panel.kind === "news" ? <CouncilNewsPanel calendar={panel.calendar} /> : null}
      </div>
    </div>
  )
}
